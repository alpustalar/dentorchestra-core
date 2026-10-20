import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { UnbridgedBookingLedgerView } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.response';
import { FindUnbridgedBookingLedgerEntriesQuery } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.query';
import { BookingPlatformLedgerService } from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { BackfillBookingLedgerEntriesCommand } from './backfill-booking-ledger-entries.command';
import { BackfillBookingLedgerEntriesResponse } from './backfill-booking-ledger-entries.response';

/**
 * Platform defterine yazılamamış rezervasyon fişlerinin telafisi.
 *
 * Köprü bilerek best-effort (para hareket etmişken muhasebe hatası işlemi geri
 * almamalı), ama alarm tek başına çözüm değildir: CLAUDE.md finans kuralı 4
 * yutulan her kritik iş için **yeniden deneme ya da backfill + "eksik kalanlar"
 * sorgusu** istiyor. Bu komut o çiftin yazma yarısıdır.
 *
 * Mükerrer yazma riski yok: her olay `dedupeKey` ile yazılıyor ve liste zaten
 * yazılmış olanları dışlıyor; ikisi birbirinden bağımsız iki emniyet.
 */
@CommandHandler(BackfillBookingLedgerEntriesCommand)
export class BackfillBookingLedgerEntriesHandler implements ICommandHandler<
  BackfillBookingLedgerEntriesCommand,
  BackfillBookingLedgerEntriesResponse
> {
  private readonly logger = new Logger(
    BackfillBookingLedgerEntriesHandler.name
  );

  constructor(
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly platformLedger: BookingPlatformLedgerService,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    command: BackfillBookingLedgerEntriesCommand
  ): Promise<BackfillBookingLedgerEntriesResponse> {
    const { data, ctx } = command.payload;

    // Yetki defterin sahibinden: platform defterini onarmak klinik personelinin
    // işi değil (sorgu tarafıyla aynı gerekçe).
    const target = await this.platformTenant.resolve();

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(target.clinicId),
        'Platform defterini onarma yetkiniz yok.'
      )
      .orThrow('health-tourism.booking-payment.backfill-ledger');

    const { data: missing } = await this.queryBus.execute(
      new FindUnbridgedBookingLedgerEntriesQuery({
        filter: { from: data.from, to: data.to, clinicId: data.clinicId },
        ctx,
      })
    );

    const failed: BackfillBookingLedgerEntriesResponse['failed'] = [];
    let recorded = 0;

    for (const entry of missing) {
      try {
        // Kayıt **Command Repo'dan** yükleniyor: okunan veri bir yazma kararını
        // besliyor (fişin tutarları) — Query Repo'nun read-replica'dan dönme
        // ihtimali bayat tutarla fiş yazmak demekti (CLAUDE.md CQRS kuralı).
        const failure = await this.bridge(entry);
        if (failure) {
          failed.push({
            bookingPaymentId: entry.bookingPaymentId,
            kind: entry.kind,
            reason: failure,
          });
          continue;
        }
        recorded += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Platform defteri telafisi başarısız: bp=${entry.bookingPaymentId}, kind=${entry.kind}`,
          error
        );
        failed.push({
          bookingPaymentId: entry.bookingPaymentId,
          kind: entry.kind,
          reason,
        });
      }
    }

    return { attempted: missing.length, recorded, failed };
  }

  /**
   * Tek bir eksik hareketi yönüne göre köprüler; yazılamayan için gerekçe metni döner.
   *
   * Yön satırdan okunur — hepsini "tahsilat" olarak yazmak, iade edilen parayı deftere ikinci
   * kez gelir gibi geçirirdi (§65'in dersi). İade yönü **iade satırından** beslenir: tarih ve
   * kanal rezervasyon satırının "talep edildi" damgasından değil, sağlayıcıda gerçekleşen
   * iadeden gelir.
   */
  private async bridge(
    entry: UnbridgedBookingLedgerView
  ): Promise<string | null> {
    if (entry.kind === 'SETTLED') {
      const bp = await this.bookingPaymentRepo.findById(entry.bookingPaymentId);
      if (!bp) return 'Ödeme kaydı bulunamadı.';

      const provider = bp.paidProvider;
      if (!provider) {
        // Rezervasyon açılmış ama ödeme kanalı boş: fiş açıklaması bu alandan beslenir ve
        // uydurulamaz (hangi kanaldan tahsil edildiği bilgisi).
        return 'Tahsilat kanalı (paidProvider) kayıtta yok.';
      }

      await this.platformLedger.record({ kind: 'SETTLED', bp, provider });
      return null;
    }

    const refund = entry.refundId
      ? await this.refundRepo.findById(entry.refundId)
      : null;
    if (!refund) return 'İade kaydı bulunamadı.';

    if (entry.kind === 'REFUNDED') {
      const bp = await this.bookingPaymentRepo.findById(entry.bookingPaymentId);
      if (!bp) return 'Ödeme kaydı bulunamadı.';
      return this.recordCancellationRefund({ bp, refund });
    }

    return this.recordReturnable({ entry, refund });
  }

  private async recordCancellationRefund(params: {
    bp: BookingPayment;
    refund: BookingPaymentRefund;
  }): Promise<string | null> {
    const { bp, refund } = params;
    if (refund.status !== 'CONFIRMED' || !refund.refundedAt) {
      // Doğrulanmamış iade için ters fiş yazılmaz: para dönmemiş olabilir (P0-3).
      return 'İade sağlayıcıda doğrulanmadı; ters kayıt yazılmaz.';
    }

    await this.platformLedger.record({
      kind: 'REFUNDED',
      bp,
      provider: refund.provider,
      occurredAt: refund.refundedAt,
    });
    return null;
  }

  private async recordReturnable(params: {
    entry: UnbridgedBookingLedgerView;
    refund: BookingPaymentRefund;
  }): Promise<string | null> {
    const { entry, refund } = params;
    if (entry.kind === 'RETURNABLE_REFUNDED' && refund.status !== 'CONFIRMED') {
      return 'İade sağlayıcıda doğrulanmadı; 336 kapanış kaydı yazılmaz.';
    }

    const bp = await this.bookingPaymentRepo.findById(entry.bookingPaymentId);
    await this.platformLedger.recordReturnable({
      kind:
        entry.kind === 'RETURNABLE_REFUNDED'
          ? 'RETURNABLE_REFUNDED'
          : 'RETURNABLE_RECEIVED',
      refund,
      receivedAt:
        refund.kind === 'BOOKING_FAILED' ? (bp?.paidAt ?? null) : null,
    });
    return null;
  }
}
