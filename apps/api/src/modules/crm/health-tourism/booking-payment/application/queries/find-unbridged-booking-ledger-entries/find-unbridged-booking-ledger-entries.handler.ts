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
import {
  BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY,
  IBookingPaymentRefundQueryRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.query.repository';
import type { BookingPaymentRefund } from '@shared';
import { FindUnbridgedBookingLedgerEntriesQuery } from './find-unbridged-booking-ledger-entries.query';
import {
  FindUnbridgedBookingLedgerEntriesResponse,
  UnbridgedBookingLedgerKind,
  UnbridgedBookingLedgerView,
} from './find-unbridged-booking-ledger-entries.response';

/** Borçlu olunan tek bir fiş (yön + anahtar + tarih). */
interface ExpectedEntry {
  readonly bookingPaymentId: string;
  readonly clinicId: string;
  readonly bookingType: string | null;
  readonly kind: UnbridgedBookingLedgerKind;
  readonly dedupeKey: string;
  readonly occurredAt: Date | null;
  readonly refundId: string | null;
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
    @Inject(BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY)
    private readonly refundQueryRepo: IBookingPaymentRefundQueryRepository,
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

    const window = {
      from: filter.from,
      to: filter.to,
      clinicId: filter.clinicId,
    };
    const [rows, refunds] = await Promise.all([
      this.bookingPaymentQueryRepo.findBridgeable(window),
      this.refundQueryRepo.findBridgeable(window),
    ]);

    // Tahsilat yönü rezervasyon satırından, iade / 336 yönü iade SATIRINDAN türer: `refundedAt`
    // rezervasyon satırında "iade talep edildi" demekti ve sağlayıcı reddetse de dolardı.
    const expected = [
      ...rows.map((row) => this.settledEntry(row)),
      ...refunds.flatMap((refund) => this.refundEntries(refund)),
    ];
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
            bookingPaymentId: entry.bookingPaymentId,
            clinicId: entry.clinicId,
            bookingType: entry.bookingType,
            kind: entry.kind,
            dedupeKey: entry.dedupeKey,
            occurredAt: entry.occurredAt,
            refundId: entry.refundId,
          })
        ),
      meta: { serializationOptions },
    };
  }

  /** Tahsilat her zaman borçludur: aday olma koşulu rezervasyonun fiilen açılmış olması. */
  private settledEntry(row: BridgeableBookingLedgerRow): ExpectedEntry {
    return {
      bookingPaymentId: row.bookingPaymentId,
      clinicId: row.clinicId,
      bookingType: row.bookingType,
      kind: 'SETTLED',
      dedupeKey: FinancialEventDedupeKeys.platform_booking_settled(
        row.bookingPaymentId
      ),
      occurredAt: row.paidAt,
      refundId: null,
    };
  }

  /**
   * Bir iade satırının borçlu olduğu fişler.
   *
   * - `CANCELLATION` CONFIRMED → `PLATFORM_BOOKING_REFUNDED` (iade storno değil, ayrı olay).
   *   Doğrulanmamış (UNCONFIRMED / FAILED / PENDING) iade için ters fiş BORÇLU DEĞİLDİR:
   *   para dönmemiş olabilir ve fiş "döndü" derdi — satır `refunds/unresolved` listesinde görünür.
   * - İade edilecek tahsilat (çift çekim / başarısız rezervasyon) iyzico/TRY:
   *   `RECEIVED` (336 açılışı) LIVE satırlarda onaylanmasa da borçlu — para platform hesabına
   *   girdi; LEGACY satırda yalnız onaylanınca (geçmişi yorumlamayız). `REFUNDED` yalnız CONFIRMED.
   * - Stripe / TRY dışı: 336 yoluna girmez (Stripe kapalı).
   */
  private refundEntries(refund: BookingPaymentRefund): ExpectedEntry[] {
    const base = {
      bookingPaymentId: refund.bookingPaymentId,
      clinicId: refund.clinicId,
      // Rezervasyon türü iade satırında tutulmaz; fiş açıklaması telafi anında bp'den okunur.
      bookingType: null,
      refundId: refund.id,
    };
    const confirmed = refund.status === 'CONFIRMED';

    if (refund.kind === 'CANCELLATION') {
      return confirmed
        ? [
            {
              ...base,
              kind: 'REFUNDED',
              dedupeKey: FinancialEventDedupeKeys.platform_booking_refunded(
                refund.bookingPaymentId
              ),
              occurredAt: refund.refundedAt,
            },
          ]
        : [];
    }

    if (refund.provider !== 'IYZICO' || refund.currency !== 'TRY') return [];

    const entries: ExpectedEntry[] = [];
    if (refund.origin === 'LIVE' || confirmed) {
      entries.push({
        ...base,
        kind: 'RETURNABLE_RECEIVED',
        dedupeKey: FinancialEventDedupeKeys.platform_returnable_charge_received(
          refund.provider,
          refund.chargeProviderRef
        ),
        occurredAt: refund.requestedAt,
      });
    }
    if (confirmed) {
      entries.push({
        ...base,
        kind: 'RETURNABLE_REFUNDED',
        dedupeKey: FinancialEventDedupeKeys.platform_returnable_charge_refunded(
          refund.provider,
          refund.chargeProviderRef
        ),
        occurredAt: refund.refundedAt,
      });
    }
    return entries;
  }
}
