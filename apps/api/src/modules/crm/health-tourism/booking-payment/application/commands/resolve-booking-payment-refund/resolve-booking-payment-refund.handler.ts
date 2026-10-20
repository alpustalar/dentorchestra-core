import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import {
  FINANCIAL_EVENT_PRESENCE_GUARD,
  IFinancialEventPresenceGuard,
} from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard.interface';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import {
  BookingPaymentRefundNotFoundException,
  BookingPaymentRefundReversalAlreadyRecordedException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { BookingPaymentNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPlatformLedgerService } from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { ResolveBookingPaymentRefundCommand } from './resolve-booking-payment-refund.command';
import { ResolveBookingPaymentRefundResponse } from './resolve-booking-payment-refund.response';

/**
 * Sonucu doğrulanamamış (UNCONFIRMED) ya da takılmış (bayat PENDING) iadenin ELLE kapatılması.
 *
 * Operatör sağlayıcı panelinden (iyzico: `conversationId` = idempotency anahtarı) doğrular:
 *   - `CONFIRMED`    → satır CONFIRMED + ters kayıt (iptal: `REFUNDED` fişi; çift çekim /
 *                      başarısız rezervasyon: `B 336 / A 108`) iadenin gerçekleştiği güne yazılır.
 *   - `NOT_REFUNDED` → satır FAILED; neden giderilince `retry` ile yeniden denenir.
 *
 * Kapı sırası (tek `outboxRun`, kural 1 + 3 + 7): yetki → bp kilidi → iade kilidi →
 * çözülebilir mi → [CONFIRMED: dönem kapısı | NOT_REFUNDED: ters fiş zaten yazılı mı] →
 * geçiş → güncelle (+ audit olayı). Çözülemeyen satır için dönem kapısı bile çağrılmaz.
 *
 * Ters fiş commit SONRASI best-effort yazılır: karar kalıcıdır, defter hatası kararı geri
 * almaz; eksik kalırsa `find-unbridged` + backfill ile görünür/onarılır (kural 4).
 */
@CommandHandler(ResolveBookingPaymentRefundCommand)
export class ResolveBookingPaymentRefundHandler implements ICommandHandler<
  ResolveBookingPaymentRefundCommand,
  ResolveBookingPaymentRefundResponse
> {
  constructor(
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    @Inject(FINANCIAL_EVENT_PRESENCE_GUARD)
    private readonly presenceGuard: IFinancialEventPresenceGuard,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    private readonly platformLedger: BookingPlatformLedgerService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: ResolveBookingPaymentRefundCommand
  ): Promise<ResolveBookingPaymentRefundResponse> {
    const { refundId, data, ctx } = command.payload;

    // Yetki defterin sahibinden: platform iadesini kapatmak klinik personelinin işi değil.
    const target = await this.platformTenant.resolve();
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(target.clinicId),
        'Platform iadesini kapatma yetkiniz yok.'
      )
      .orThrow('health-tourism.booking-payment-refund.resolve');

    // Kilit sırası bp → iade olduğundan bp kimliği için kilitsiz bir ön okuma gerekir.
    // Karar bu okumaya DAYANMAZ: asıl okuma tx içinde ve kilitli.
    const probe = await this.refundRepo.findById(refundId);
    if (!probe) throw new BookingPaymentRefundNotFoundException();

    const saved = await this.txManager.outboxRun(async () => {
      const bp = await this.bookingPaymentRepo.findByIdForUpdate(
        probe.bookingPaymentId.value
      );
      if (!bp) throw new BookingPaymentNotFoundException();

      const refund = await this.refundRepo.findByIdForUpdate(refundId);
      if (!refund) throw new BookingPaymentRefundNotFoundException();

      refund.assertResolvable();

      if (data.outcome === 'CONFIRMED') {
        // Ters kayıt iadenin gerçekleştiği güne düşer: mühürlü döneme yazılamaz (kural 1).
        await this.periodGate.assertPeriodNotSealedAt({
          clinicId: target.clinicId,
          date: data.refundedAt as Date,
        });
      } else {
        await this.assertReversalNotRecorded({
          refund,
          platformClinicId: target.clinicId,
        });
      }

      refund.resolve({
        outcome: data.outcome,
        resolvedById: ctx.actor.userId,
        note: data.note,
        refundedAt: data.refundedAt,
        providerRefundRef: data.providerRefundRef ?? null,
      });

      // Başarısız rezervasyonun iadesi doğrulanınca rezervasyon kaydı REFUNDED olur
      // (yürütücüdeki otomatik yolun aynısı).
      if (
        data.outcome === 'CONFIRMED' &&
        refund.kind === 'BOOKING_FAILED' &&
        bp.status === 'FAILED'
      ) {
        bp.markRefunded({
          reason: refund.reason ?? 'Rezervasyon açılamadı; ödeme iade edildi.',
          retained: null,
        });
        await this.bookingPaymentRepo.update(bp);
      }

      return { refund: await this.refundRepo.update(refund), bp };
    });

    if (saved.refund.status === 'CONFIRMED') {
      await this.platformLedger.bridgeConfirmedRefundBestEffort({
        refund: saved.refund,
        bp: saved.bp,
      });
    }

    return { refundId: saved.refund.id.value, status: saved.refund.status };
  }

  /**
   * "İade gerçekleşmedi" kararı, o iade için ters kayıt zaten yazılıysa verilemez: yazılmış
   * bir fişi geri almak storno + yeni anahtar demektir (kural 11 — muhasebe kararı).
   */
  private async assertReversalNotRecorded(params: {
    refund: BookingPaymentRefund;
    platformClinicId: string;
  }): Promise<void> {
    const dedupeKey = this.platformLedger.reversalDedupeKey(params.refund);
    if (!dedupeKey) return;

    const recorded = await this.presenceGuard.isRecorded({
      clinicId: params.platformClinicId,
      dedupeKey,
    });
    if (recorded) {
      throw new BookingPaymentRefundReversalAlreadyRecordedException();
    }
  }
}
