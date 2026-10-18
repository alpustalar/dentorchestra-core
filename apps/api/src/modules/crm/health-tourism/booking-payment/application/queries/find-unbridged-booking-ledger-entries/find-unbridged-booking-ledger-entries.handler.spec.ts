import { FindUnbridgedBookingLedgerEntriesHandler } from './find-unbridged-booking-ledger-entries.handler';
import { FindUnbridgedBookingLedgerEntriesQuery } from './find-unbridged-booking-ledger-entries.query';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IBookingPaymentQueryRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.query.repository';
import { IPlatformTenantProvider } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { BridgeableBookingLedgerRow } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
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
  refundedAt: null,
  ...overrides,
});

/**
 * Mock'lar girdi tipleriyle tiplenir: argümansız `jest.fn()` çağrı tuple'ını
 * `[]` olarak tipler ve `mock.calls[0][0]` okuması TS2493/TS2352 verir.
 */
type FinanceRule = { canAccessClinicFinances: (clinicId: string) => boolean };
type CheckFn = jest.Mock<
  { orThrow: (operation?: string) => void },
  [(policy: FinanceRule) => boolean, string?]
>;

const build = (rows: BridgeableBookingLedgerRow[], existingKeys: string[]) => {
  const findBridgeable = jest.fn(() => Promise.resolve(rows));
  const repo = { findBridgeable } as unknown as IBookingPaymentQueryRepository;

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
      platformTenant,
      policyFactory,
      queryBus
    ),
    findBridgeable,
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

  it('tahsilatı yazılmış ama İADESİ eksik kayıtta yalnız iade listelenir', async () => {
    // §68'de ölçülen engelin testi: `sourceRefId` kümesine bakan sorgu bu iki
    // yönü ayırt edemiyordu ve tahsilatı yazılmış bir rezervasyonun eksik iade
    // fişini "köprülenmiş" sayıyordu. Anahtar yön başına ayrı olduğu için
    // soru burada doğru cevaplanıyor.
    const { handler } = build(
      [
        row({
          status: 'REFUNDED',
          refundedAt: new Date('2026-09-20T10:00:00Z'),
        }),
      ],
      [`platform-booking-settled:${BP_ID}`]
    );

    const { data } = await run(handler);

    expect(data).toHaveLength(1);
    expect(data[0]).toEqual(
      expect.objectContaining({
        kind: 'REFUNDED',
        dedupeKey: `platform-booking-refunded:${BP_ID}`,
      })
    );
  });

  it('iade edilmiş kayıtta İKİ fiş de beklenir (iade storno değil)', async () => {
    const { handler } = build(
      [
        row({
          status: 'REFUNDED',
          refundedAt: new Date('2026-09-20T10:00:00Z'),
        }),
      ],
      []
    );

    const { data } = await run(handler);

    expect(data.map((e) => e.kind)).toEqual(['SETTLED', 'REFUNDED']);
  });

  it('iki fiş de yazılmışsa liste boş', async () => {
    const { handler } = build(
      [
        row({
          status: 'REFUNDED',
          refundedAt: new Date('2026-09-20T10:00:00Z'),
        }),
      ],
      [
        `platform-booking-settled:${BP_ID}`,
        `platform-booking-refunded:${BP_ID}`,
      ]
    );

    const { data } = await run(handler);

    expect(data).toEqual([]);
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
