import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPaymentLinkProvider,
  IYZICO_PAYMENT_LINK,
  RefundPaymentLinkResult,
  STRIPE_PAYMENT_LINK,
} from '@src/infrastructure/payment/links/payment-link.port';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundSettleConflictException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { BookingPaymentRefundStatusValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';
import { BookingPlatformLedgerService } from './booking-platform-ledger.service';

export interface BookingPaymentRefundExecution {
  readonly refundId: string;
  /** Sağlayıcı çağrısı sonrası satırın durumu; araya giren akış varsa o anki durum. */
  readonly status: BookingPaymentRefundStatusValue;
  /** Settle tx'i başka bir akışla çakıştı: sonuç yazılmadı (alarm basıldı). */
  readonly settleConflict: boolean;
}

/**
 * Talep edilmiş (PENDING) bir iadeyi sağlayıcıda yürütür ve sonucu kaydeder.
 *
 * Üç kısa adım, sağlayıcı çağrısı HİÇBİR transaction içinde değil (uzun kilit tutmaz):
 *   1. (çağıran) claim tx'i: satır PENDING yaratıldı — çift iade bu satırın unique'iyle engellenir.
 *   2. sağlayıcı çağrısı → ÜÇ durumlu sonuç (oldu / olmadı / bilinmiyor).
 *   3. settle tx'i: bp kilidi → iade kilidi → `PENDING && girişim eşleşiyor` kontrolü → geçiş.
 *
 * Fırlatmaz: REJECTED ve UNKNOWN beklenen sonuçlardır (satır FAILED / UNCONFIRMED olur), taşıma
 * hatası UNKNOWN sayılır. Hata fırlatmak çağıranın telafi dalını tetikler ve "olmadı" ile
 * "bilinmiyor"u ayırt edilemez kılar. `UNCONFIRMED` ASLA otomatik yeniden denenmez (zaman aşımı
 * sağlayıcıda başarı olabilir → çift iade).
 */
@Injectable()
export class BookingPaymentRefundExecutor {
  private readonly logger = new Logger(BookingPaymentRefundExecutor.name);

  constructor(
    @Inject(IYZICO_PAYMENT_LINK)
    private readonly iyzicoLink: IPaymentLinkProvider,
    @Inject(STRIPE_PAYMENT_LINK)
    private readonly stripeLink: IPaymentLinkProvider,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    private readonly platformLedger: BookingPlatformLedgerService,
    private readonly criticalFailure: CriticalFailurePublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    refund: BookingPaymentRefund
  ): Promise<BookingPaymentRefundExecution> {
    const attempt = refund.attemptCount;

    // 336 açılışı sağlayıcı çağrısından ÖNCE: çağrı sonucu ne olursa olsun para platform
    // hesabına girmiştir. Defter hatası iadeyi durdurmaz (best-effort + alarm).
    await this.openReturnableLedger(refund);

    const result = await this.callProvider(refund);

    return this.settle({ refund, attempt, result });
  }

  private async openReturnableLedger(
    refund: BookingPaymentRefund
  ): Promise<void> {
    if (!this.platformLedger.isReturnableLedgerable(refund)) return;

    const bp = await this.bookingPaymentRepo.findById(
      refund.bookingPaymentId.value
    );
    await this.platformLedger.recordReturnableBestEffort({
      kind: 'RETURNABLE_RECEIVED',
      refund,
      receivedAt:
        refund.kind === 'BOOKING_FAILED' ? (bp?.paidAt ?? null) : null,
    });
  }

  private async callProvider(
    refund: BookingPaymentRefund
  ): Promise<RefundPaymentLinkResult> {
    const adapter =
      refund.provider === 'IYZICO' ? this.iyzicoLink : this.stripeLink;

    try {
      return await adapter.refund({
        providerRef: refund.chargeProviderRef,
        amount: refund.amount.value.toNumber(),
        currency: refund.amount.currency,
        reason: refund.reason ?? undefined,
        idempotencyKey: refund.idempotencyKey,
      });
    } catch (err) {
      // Zaman aşımı / bağlantı kopması: sağlayıcıda başarılı olmuş OLABİLİR.
      return {
        outcome: 'UNKNOWN',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async settle(params: {
    refund: BookingPaymentRefund;
    attempt: number;
    result: RefundPaymentLinkResult;
  }): Promise<BookingPaymentRefundExecution> {
    const { refund, attempt, result } = params;

    let settled: BookingPaymentRefund;
    try {
      settled = await this.txManager.run(async () => {
        // Kilit sırası HER ZAMAN: önce booking_payments, sonra iade satırı.
        const bp = await this.bookingPaymentRepo.findByIdForUpdate(
          refund.bookingPaymentId.value
        );
        const locked = await this.refundRepo.findByIdForUpdate(refund.id.value);
        if (!locked)
          throw new Error(`İade kaydı bulunamadı: ${refund.id.value}`);

        this.applyResult({ locked, attempt, result });

        // Başarısız rezervasyonun iadesi onaylanınca rezervasyon kaydı REFUNDED olur
        // (iptalde claim anında REFUNDED konmuştu; çift çekimde bp'ye dokunulmaz).
        if (
          locked.kind === 'BOOKING_FAILED' &&
          locked.status === 'CONFIRMED' &&
          bp
        ) {
          bp.markRefunded({
            reason:
              locked.reason ?? 'Rezervasyon açılamadı; ödeme iade edildi.',
            retained: null,
          });
          await this.bookingPaymentRepo.update(bp);
        }

        return this.refundRepo.update(locked);
      });
    } catch (err) {
      if (err instanceof BookingPaymentRefundSettleConflictException) {
        // Araya başka akış (elle karar / yeniden deneme) girmiş: sonucu EZMEYİZ (kural 3).
        // Sağlayıcıdaki gerçek sonuç alarmda; kalıcı karar elle verilir.
        this.criticalFailure.publish({
          operation: 'health-tourism.booking-payment.refund-settle-conflict',
          severity: 'CRITICAL',
          summary:
            'İade sağlayıcıda sonuçlandı ama satır artık PENDING değil (araya başka akış girdi); sonuç yazılmadı.',
          errorMessage: err.message,
          context: {
            refundId: refund.id.value,
            attempt: String(attempt),
            outcome: result.outcome,
          },
          clinicId: refund.clinicId.value,
          dedupeKey: `booking-refund-settle-conflict:${refund.id.value}:${attempt}`,
        });
        const current = await this.refundRepo.findById(refund.id.value);
        return {
          refundId: refund.id.value,
          status: current?.status ?? refund.status,
          settleConflict: true,
        };
      }
      throw err;
    }

    this.announce({ refund: settled, attempt, result });

    if (settled.status === 'CONFIRMED') {
      const bp = await this.bookingPaymentRepo.findById(
        settled.bookingPaymentId.value
      );
      if (bp) {
        await this.platformLedger.bridgeConfirmedRefundBestEffort({
          refund: settled,
          bp,
        });
      }
    }

    this.logger.log(
      `İade sonucu (refund=${settled.id.value}, provider=${settled.provider}): ${settled.status}`
    );

    return {
      refundId: settled.id.value,
      status: settled.status,
      settleConflict: false,
    };
  }

  private applyResult(params: {
    locked: BookingPaymentRefund;
    attempt: number;
    result: RefundPaymentLinkResult;
  }): void {
    const { locked, attempt, result } = params;

    switch (result.outcome) {
      case 'SUCCEEDED':
        locked.markConfirmedByProvider({
          attempt,
          providerRefundRef: result.providerRefundRef,
        });
        return;
      case 'REJECTED':
        locked.markRejectedByProvider({
          attempt,
          failureReason: `${result.errorCode ?? 'HATA'}: ${result.errorMessage}`,
        });
        return;
      case 'UNKNOWN':
        locked.markUnconfirmed({ attempt, failureReason: result.detail });
        return;
    }
  }

  /** REJECTED ve UNKNOWN insana gider; ters fiş YAZILMAZ ("iade edildi" demek yanlış beyan olurdu). */
  private announce(params: {
    refund: BookingPaymentRefund;
    attempt: number;
    result: RefundPaymentLinkResult;
  }): void {
    const { refund, attempt, result } = params;
    if (result.outcome === 'SUCCEEDED') return;

    const unconfirmed = result.outcome === 'UNKNOWN';
    this.criticalFailure.publish({
      operation: 'health-tourism.booking-payment.refund',
      severity: 'CRITICAL',
      summary: unconfirmed
        ? 'Rezervasyon iadesi sağlayıcıda DOĞRULANAMADI: para geri gitmiş olabilir. Satır UNCONFIRMED; sağlayıcı panelinden doğrulanıp elle kapatılmalı. Ters kayıt yazılmadı.'
        : 'Rezervasyon iadesi sağlayıcı tarafından REDDEDİLDİ: para geri gitmedi. Satır FAILED; neden giderilince yeniden denenebilir. Ters kayıt yazılmadı.',
      errorMessage:
        result.outcome === 'REJECTED' ? result.errorMessage : result.detail,
      context: {
        refundId: refund.id.value,
        bookingPaymentId: refund.bookingPaymentId.value,
        kind: refund.kind,
        provider: refund.provider,
        chargeProviderRef: refund.chargeProviderRef,
        amount: refund.amount.toApiFormat(),
        currency: refund.amount.currency,
        idempotencyKey: refund.idempotencyKey,
      },
      clinicId: refund.clinicId.value,
      dedupeKey: `booking-refund-${unconfirmed ? 'unconfirmed' : 'rejected'}:${refund.id.value}:${attempt}`,
    });
  }
}
