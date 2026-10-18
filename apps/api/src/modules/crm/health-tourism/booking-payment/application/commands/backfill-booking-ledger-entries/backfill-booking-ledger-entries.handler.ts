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
        const bp = await this.bookingPaymentRepo.findById(
          entry.bookingPaymentId
        );
        if (!bp) {
          failed.push({
            bookingPaymentId: entry.bookingPaymentId,
            kind: entry.kind,
            reason: 'Ödeme kaydı bulunamadı.',
          });
          continue;
        }

        const provider = bp.paidProvider;
        if (!provider) {
          // Rezervasyon açılmış ama ödeme kanalı boş: fiş açıklaması bu alandan
          // besleniyor ve uydurulamaz (hangi kanaldan tahsil edildiği bilgisi).
          failed.push({
            bookingPaymentId: entry.bookingPaymentId,
            kind: entry.kind,
            reason: 'Tahsilat kanalı (paidProvider) kayıtta yok.',
          });
          continue;
        }

        // Her hareket kendi başına köprülenir: biri patlarsa tur durmaz,
        // kalanlar yazılır ve başarısızlar gerekçesiyle dönülür.
        //
        // Yön satırdan okunur — hepsini "tahsilat" olarak yazmak, iade edilen
        // parayı deftere ikinci kez gelir gibi geçirirdi (§65'in dersi).
        await this.platformLedger.record({
          kind: entry.kind,
          bp,
          provider,
        });
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
}
