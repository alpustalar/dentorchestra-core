import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { FindExistingFinancialEventDedupeKeysQuery } from '@modules/finance/accounting/financial-events/application/queries/find-existing-financial-event-dedupe-keys/find-existing-financial-event-dedupe-keys.query';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import {
  BOOKING_PAYMENT_QUERY_REPOSITORY,
  IBookingPaymentQueryRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.query.repository';
import { BridgeableBookingLedgerRow } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { FindUnbridgedBookingLedgerEntriesQuery } from './find-unbridged-booking-ledger-entries.query';
import {
  FindUnbridgedBookingLedgerEntriesResponse,
  UnbridgedBookingLedgerView,
} from './find-unbridged-booking-ledger-entries.response';

/** Bir rezervasyonun borçlu olduğu tek bir fiş (yön + anahtar + tarih). */
interface ExpectedEntry {
  readonly row: BridgeableBookingLedgerRow;
  readonly kind: 'SETTLED' | 'REFUNDED';
  readonly dedupeKey: string;
  readonly occurredAt: Date | null;
}

/**
 * Platform defterine köprüsü kurulmamış rezervasyon hareketlerini bulur —
 * tahsilat **ve** iade.
 *
 * Adaylar bu modülden (rezervasyonu fiilen açılmış ödeme kayıtları), "olayı var
 * mı" bilgisi `financial-events` modülünden QueryBus ile gelir: bu modül
 * `financial_events` tablosunu okumaz (bounded context).
 *
 * **Yetki platform kiracısı üzerinden değerlendirilir**, rezervasyonun kliniği
 * üzerinden değil: defter platforma aittir ve klinik bu işleme finansal olarak
 * taraf değildir (komisyon marjını klinik personeline göstermek yanlış olurdu).
 * `filter.clinicId` yalnızca **daraltmadır**.
 *
 * **Neden `dedupeKey` ile sorulur, `sourceRefId` ile değil:** aynı
 * `bookingPaymentId` iki olaya kaynaklık eder (tahsilat + iade). Referans
 * kümesine bakan sorgu bu iki yönü ayırt edemez ve tahsilatı yazılmış bir
 * rezervasyonun **eksik iade fişini** "köprülenmiş" sayardı.
 */
@QueryHandler(FindUnbridgedBookingLedgerEntriesQuery)
export class FindUnbridgedBookingLedgerEntriesHandler implements IQueryHandler<
  FindUnbridgedBookingLedgerEntriesQuery,
  FindUnbridgedBookingLedgerEntriesResponse
> {
  constructor(
    @Inject(BOOKING_PAYMENT_QUERY_REPOSITORY)
    private readonly bookingPaymentQueryRepo: IBookingPaymentQueryRepository,
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: FindUnbridgedBookingLedgerEntriesQuery
  ): Promise<FindUnbridgedBookingLedgerEntriesResponse> {
    const { filter, ctx } = query.payload;

    const target = await this.platformTenant.resolve();

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(target.clinicId),
        'Platform defterine erişim yetkiniz yok.'
      )
      .orThrow('health-tourism.booking-payment.unbridged');

    const serializationOptions = policy.getSerializationOptions({
      clinicId: target.clinicId,
    });

    const rows = await this.bookingPaymentQueryRepo.findBridgeable({
      from: filter.from,
      to: filter.to,
      clinicId: filter.clinicId,
    });

    const expected = rows.flatMap((row) => this.expectedEntries(row));
    if (expected.length === 0) {
      return { data: [], meta: { serializationOptions } };
    }

    const { data: existingKeys } = await this.queryBus.execute(
      new FindExistingFinancialEventDedupeKeysQuery({
        filter: {
          clinicId: target.clinicId,
          dedupeKeys: expected.map((entry) => entry.dedupeKey),
        },
        ctx,
      })
    );

    const written = new Set(existingKeys);

    return {
      data: expected
        .filter((entry) => !written.has(entry.dedupeKey))
        .map(
          (entry): UnbridgedBookingLedgerView => ({
            bookingPaymentId: entry.row.bookingPaymentId,
            clinicId: entry.row.clinicId,
            bookingType: entry.row.bookingType,
            kind: entry.kind,
            dedupeKey: entry.dedupeKey,
            occurredAt: entry.occurredAt,
          })
        ),
      meta: { serializationOptions },
    };
  }

  /**
   * Bir kaydın borçlu olduğu fişler. Tahsilat her zaman borçludur (aday olma
   * koşulu rezervasyonun açılmış olması); iade yalnız fiilen gerçekleştiyse.
   *
   * İade edilmiş bir kayıtta **iki** fiş de beklenir: tahsilat o gün gerçekten
   * olmuştu ve iade onun storno'su değil, ayrı bir ekonomik olaydır (§65/§67).
   */
  private expectedEntries(row: BridgeableBookingLedgerRow): ExpectedEntry[] {
    const entries: ExpectedEntry[] = [
      {
        row,
        kind: 'SETTLED',
        dedupeKey: FinancialEventDedupeKeys.platform_booking_settled(
          row.bookingPaymentId
        ),
        occurredAt: row.paidAt,
      },
    ];

    if (row.refundedAt) {
      entries.push({
        row,
        kind: 'REFUNDED',
        dedupeKey: FinancialEventDedupeKeys.platform_booking_refunded(
          row.bookingPaymentId
        ),
        occurredAt: row.refundedAt,
      });
    }

    return entries;
  }
}
