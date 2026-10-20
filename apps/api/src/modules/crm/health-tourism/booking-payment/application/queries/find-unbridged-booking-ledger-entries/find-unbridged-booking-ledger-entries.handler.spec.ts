import { FindUnbridgedBookingLedgerEntriesHandler } from './find-unbridged-booking-ledger-entries.handler';
import { FindUnbridgedBookingLedgerEntriesQuery } from './find-unbridged-booking-ledger-entries.query';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IBookingPaymentQueryRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.query.repository';
import { IPlatformTenantProvider } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { IBookingPaymentRefundQueryRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.query.repository';
import type { BookingPaymentRefund } from '@shared';
import { BridgeableBookingLedgerRow } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { FindExistingFinancialEventDedupeKeysQuery } from '@modules/finance/accounting/financial-events/application/queries/find-existing-financial-event-dedupe-keys/find-existing-financial-event-dedupe-keys.query';

const PLATFORM_CLINIC = '99999999-9999-4999-8999-999999999999';
const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const BP_ID = '33333333-3333-4333-8333-333333333333';

const ctx: IGetContext = {
  actor: {
    userId: 'actor-1',
    clinicId: PLATFORM_CLINIC,
    organizationId: '88888888-8888-4888-8888-888888888888',
    managedClinics: [{ id: PLATFORM_CLINIC }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.USER_ACTION,
};

const row = (
  overrides: Partial<BridgeableBookingLedgerRow> = {}
): BridgeableBookingLedgerRow => ({
  bookingPaymentId: BP_ID,
  clinicId: CLINIC_ID,
  bookingType: 'HOTEL',
  status: 'BOOKED',
  paidProvider: 'STRIPE',
  paidAt: new Date('2026-09-01T10:00:00Z'),
  ...overrides,
});

const REFUND_ID = '44444444-4444-4444-8444-444444444444';
const REFUNDED_AT = new Date('2026-09-20T10:00:00Z');

/** İade satırı (düz model): sağlayıcı sonucu `status`'ta, `refundedAt` yalnız CONFIRMED'da dolu. */
const refund = (
  overrides: Partial<BookingPaymentRefund> = {}
): BookingPaymentRefund =>
  ({
    id: REFUND_ID,
    bookingPaymentId: BP_ID,
    clinicId: CLINIC_ID,
    kind: 'CANCELLATION',
    origin: 'LIVE',
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-1',
    currency: 'TRY',
    status: 'CONFIRMED',
    requestedAt: new Date('2026-09-20T09:59:00Z'),
    refundedAt: REFUNDED_AT,
    ...overrides,
  }) as BookingPaymentRefund;

/**
 * Mock'lar girdi tipleriyle tiplenir: argümansız `jest.fn()` çağrı tuple'ını
 * `[]` olarak tipler ve `mock.calls[0][0]` okuması TS2493/TS2352 verir.
 */
type FinanceRule = { canAccessClinicFinances: (clinicId: string) => boolean };
type CheckFn = jest.Mock<
  { orThrow: (operation?: string) => void },
  [(policy: FinanceRule) => boolean, string?]
>;

const build = (
  rows: BridgeableBookingLedgerRow[],
  existingKeys: string[],
  refunds: BookingPaymentRefund[] = []
) => {
  const findBridgeable = jest.fn(() => Promise.resolve(rows));
  const repo = { findBridgeable } as unknown as IBookingPaymentQueryRepository;
  const findRefundsBridgeable = jest.fn(() => Promise.resolve(refunds));
  const refundRepo = {
    findBridgeable: findRefundsBridgeable,
  } as unknown as IBookingPaymentRefundQueryRepository;

  const platformTenant = {
    resolve: jest.fn(() =>
      Promise.resolve({
        clinicId: PLATFORM_CLINIC,
        organizationId: '88888888-8888-4888-8888-888888888888',
      })
    ),
  } as unknown as IPlatformTenantProvider;

  const check: CheckFn = jest.fn<
    { orThrow: (operation?: string) => void },
    [(policy: FinanceRule) => boolean, string?]
  >(() => ({ orThrow: () => undefined }));
  const policyFactory = {
    finance: jest.fn(() => ({
      evaluator: { check },
      policy: { getSerializationOptions: () => ({ groups: [] }) },
    })),
  } as unknown as IPolicyFactory;

  const execute = jest.fn<
    Promise<{ data: string[] }>,
    [FindExistingFinancialEventDedupeKeysQuery]
  >(() => Promise.resolve({ data: existingKeys }));
  const queryBus = { execute } as unknown as TSQueryBus;

  return {
    handler: new FindUnbridgedBookingLedgerEntriesHandler(
      repo,
      refundRepo,
      platformTenant,
      policyFactory,
      queryBus
    ),
    findBridgeable,
    findRefundsBridgeable,
    execute,
    policyFactory,
    check,
  };
};

const run = (handler: FindUnbridgedBookingLedgerEntriesHandler) =>
  handler.execute(
    new FindUnbridgedBookingLedgerEntriesQuery({
      filter: {
        from: new Date('2026-09-01T00:00:00Z'),
        to: new Date('2026-09-30T23:59:59Z'),
      },
      ctx,
    })
  );

describe('FindUnbridgedBookingLedgerEntriesHandler', () => {
  it('fişi hiç yazılmamış tahsilat listelenir', async () => {
    const { handler } = build([row()], []);

    const { data } = await run(handler);

    expect(data).toEqual([
      expect.objectContaining({
        bookingPaymentId: BP_ID,
        kind: 'SETTLED',
        dedupeKey: `platform-booking-settled:${BP_ID}`,
      }),
    ]);
  });

  it('tahsilatı yazılmış ama ONAYLANMIŞ İADESİ eksik kayıtta yalnız iade listelenir', async () => {
    // §68'de ölçülen engelin testi: `sourceRefId` kümesine bakan sorgu iki yönü ayırt
    // edemiyordu. Anahtar yön başına ayrı olduğu için soru burada doğru cevaplanıyor.
    const { handler } = build(
      [row()],
      [`platform-booking-settled:${BP_ID}`],
      [refund()]
    );

    const { data } = await run(handler);

    expect(data).toHaveLength(1);
    expect(data[0]).toEqual(
      expect.objectContaining({
        kind: 'REFUNDED',
        dedupeKey: `platform-booking-refunded:${BP_ID}`,
        refundId: REFUND_ID,
        occurredAt: REFUNDED_AT,
      })
    );
  });

  // P0-3: Eski kural `refundedAt != null` ⇒ "ters fiş borçlu" diyordu. `refundedAt` iade TALEP
  // edildi demekti ve sağlayıcı reddetse ya da sonuç bilinmese de doluydu: handler'ın BİLEREK
  // yazmadığı ters fişi backfill yazıyordu ("iade edildi" demek yanlış beyan).
  it.each(['UNCONFIRMED', 'FAILED', 'PENDING'] as const)(
    'DOĞRULANMAMIŞ (%s) iade için ters fiş BORÇLU DEĞİLDİR',
    async (status) => {
      const { handler } = build(
        [row()],
        [`platform-booking-settled:${BP_ID}`],
        [refund({ status, refundedAt: null })]
      );

      const { data } = await run(handler);

      expect(data).toEqual([]);
    }
  );

  it('iade edilmiş kayıtta İKİ fiş de beklenir (iade storno değil)', async () => {
    const { handler } = build([row()], [], [refund()]);

    const { data } = await run(handler);

    expect(data.map((e) => e.kind)).toEqual(['SETTLED', 'REFUNDED']);
  });

  it('iki fiş de yazılmışsa liste boş', async () => {
    const { handler } = build(
      [row()],
      [
        `platform-booking-settled:${BP_ID}`,
        `platform-booking-refunded:${BP_ID}`,
      ],
      [refund()]
    );

    const { data } = await run(handler);

    expect(data).toEqual([]);
  });

  describe('müşteriye iade edilecek tahsilat (336)', () => {
    const returnable = (over: Partial<BookingPaymentRefund> = {}) =>
      refund({
        kind: 'UNCLAIMED_CHARGE',
        chargeProviderRef: 'ptx-2',
        ...over,
      });

    it('LIVE çift çekimde 336 AÇILIŞI onaylanmasa da borçludur (para platform hesabına girdi)', async () => {
      const { handler } = build(
        [],
        [],
        [returnable({ status: 'UNCONFIRMED', refundedAt: null })]
      );

      const { data } = await run(handler);

      expect(data.map((e) => e.kind)).toEqual(['RETURNABLE_RECEIVED']);
      expect(data[0].dedupeKey).toBe(
        'platform-returnable-charge-received:IYZICO:ptx-2'
      );
    });

    it('CONFIRMED çift çekimde açılış + kapanış beklenir', async () => {
      const { handler } = build([], [], [returnable()]);

      const { data } = await run(handler);

      expect(data.map((e) => e.kind)).toEqual([
        'RETURNABLE_RECEIVED',
        'RETURNABLE_REFUNDED',
      ]);
    });

    it('LEGACY doğrulanmamış satırda açılış beklenmez (geçmişi yorumlamayız)', async () => {
      const { handler } = build(
        [],
        [],
        [
          returnable({
            origin: 'LEGACY',
            status: 'UNCONFIRMED',
            refundedAt: null,
          }),
        ]
      );

      const { data } = await run(handler);

      expect(data).toEqual([]);
    });

    it('Stripe 336 yoluna girmez (Stripe kapalı)', async () => {
      const { handler } = build(
        [],
        [],
        [returnable({ provider: 'STRIPE', currency: 'EUR' })]
      );

      const { data } = await run(handler);

      expect(data).toEqual([]);
    });
  });

  it('iade satırı penceresi repoya geçer', async () => {
    const { handler, findRefundsBridgeable } = build([], []);

    await run(handler);

    expect(findRefundsBridgeable).toHaveBeenCalledWith({
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-30T23:59:59Z'),
      clinicId: undefined,
    });
  });

  it('aday yoksa olay sorgusu HİÇ çağrılmaz', async () => {
    const { handler, execute } = build([], []);

    const { data } = await run(handler);

    expect(data).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('olay varlığı PLATFORM kliniğinde sorgulanır, rezervasyonun kliniğinde değil', async () => {
    const { handler, execute } = build([row()], []);

    await run(handler);

    const query = execute.mock.calls[0][0];
    expect(query.payload.filter.clinicId).toBe(PLATFORM_CLINIC);
    expect(query.payload.filter.clinicId).not.toBe(CLINIC_ID);
  });

  it('yetki PLATFORM kiracısı üzerinden değerlendirilir', async () => {
    // Komisyon marjı kliniğin verisi değil: klinik personelinin platform
    // defterini okuması yanlış olurdu.
    const { handler, check } = build([row()], []);

    await run(handler);

    const predicate = check.mock.calls[0][0];
    const seen: string[] = [];
    predicate({
      canAccessClinicFinances: (id: string) => {
        seen.push(id);
        return true;
      },
    });
    expect(seen).toEqual([PLATFORM_CLINIC]);
  });

  it('pencere ve klinik daraltması repoya geçer', async () => {
    const { handler, findBridgeable } = build([], []);

    await handler.execute(
      new FindUnbridgedBookingLedgerEntriesQuery({
        filter: {
          from: new Date('2026-09-01T00:00:00Z'),
          to: new Date('2026-09-30T23:59:59Z'),
          clinicId: CLINIC_ID,
        },
        ctx,
      })
    );

    expect(findBridgeable).toHaveBeenCalledWith({
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-30T23:59:59Z'),
      clinicId: CLINIC_ID,
    });
  });
});
