import { BackfillBookingLedgerEntriesHandler } from './backfill-booking-ledger-entries.handler';
import { BackfillBookingLedgerEntriesCommand } from './backfill-booking-ledger-entries.command';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { IBookingPaymentRefundCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { Money } from '@src/domain/value-objects/money.vo';
import { IPlatformTenantProvider } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BookingLedgerInput,
  BookingPlatformLedgerService,
} from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingLedgerNotPostableException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { UnbridgedBookingLedgerView } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.response';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';

const PLATFORM_CLINIC = '99999999-9999-4999-8999-999999999999';
const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

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

const hotelIntent: HotelBookingIntent = {
  type: 'HOTEL',
  hotelCode: 'H1',
  hotelName: 'Otel Bir',
  checkIn: '2026-07-01',
  checkOut: '2026-07-05',
  holderName: 'Ali',
  holderSurname: 'Veli',
  rooms: [{ rateKey: 'RK-1', paxes: [] }],
};

const props: CreateBookingPaymentProps = {
  bookingType: 'HOTEL',
  saleCurrency: 'EUR',
  saleAmount: 120,
  tryAmount: 4200,
  netAmount: 100,
  fxRate: 35,
  intent: hotelIntent,
  clinicId: CLINIC_ID,
  organizationId: '22222222-2222-4222-8222-222222222222',
  patientId: null,
  leadId: null,
  conversationId: null,
};

const booked = (): BookingPayment => {
  const bp = BookingPayment.create(props);
  bp.markPaid('STRIPE', 'pi_1');
  bp.markBooked('BK-1', 'BK-1');
  return bp;
};

const view = (
  overrides: Partial<UnbridgedBookingLedgerView> = {}
): UnbridgedBookingLedgerView => ({
  bookingPaymentId: 'bp-1',
  clinicId: CLINIC_ID,
  bookingType: 'HOTEL',
  kind: 'SETTLED',
  dedupeKey: 'platform-booking-settled:bp-1',
  occurredAt: new Date('2026-09-01T10:00:00Z'),
  refundId: null,
  ...overrides,
});

/** İade satırı: durumu parametre; CONFIRMED ise sağlayıcıda gerçekleşmiş sayılır. */
const refundIn = (
  status: 'CONFIRMED' | 'UNCONFIRMED',
  kind: 'CANCELLATION' | 'UNCLAIMED_CHARGE' | 'BOOKING_FAILED' = 'CANCELLATION'
): BookingPaymentRefund => {
  const refund = BookingPaymentRefund.request({
    bookingPaymentId: '33333333-3333-4333-8333-333333333333',
    clinicId: CLINIC_ID,
    organizationId: '22222222-2222-4222-8222-222222222222',
    kind,
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-1',
    amount: Money.fromTrusted('4200.00', 'TRY'),
  });
  if (status === 'CONFIRMED') {
    refund.markConfirmedByProvider({ attempt: 1, providerRefundRef: 'h-1' });
  } else {
    refund.markUnconfirmed({ attempt: 1, failureReason: 'ETIMEDOUT' });
  }
  return refund;
};

type FinanceRule = { canAccessClinicFinances: (clinicId: string) => boolean };

const build = (
  missing: UnbridgedBookingLedgerView[],
  entities: Record<string, BookingPayment | null> = {},
  refund: BookingPaymentRefund | null = null
) => {
  const findById = jest.fn<Promise<BookingPayment | null>, [string]>((id) =>
    Promise.resolve(id in entities ? entities[id] : booked())
  );
  const repo = { findById } as unknown as IBookingPaymentCommandRepository;

  const platformTenant = {
    resolve: jest.fn(() =>
      Promise.resolve({
        clinicId: PLATFORM_CLINIC,
        organizationId: '88888888-8888-4888-8888-888888888888',
      })
    ),
  } as unknown as IPlatformTenantProvider;

  const check = jest.fn<
    { orThrow: (operation?: string) => void },
    [(policy: FinanceRule) => boolean, string?]
  >(() => ({ orThrow: () => undefined }));
  const policyFactory = {
    finance: jest.fn(() => ({ evaluator: { check } })),
  } as unknown as IPolicyFactory;

  const findRefundById = jest.fn<
    Promise<BookingPaymentRefund | null>,
    [string]
  >(() => Promise.resolve(refund));
  const refundRepo = {
    findById: findRefundById,
  } as unknown as IBookingPaymentRefundCommandRepository;

  const record = jest.fn<Promise<void>, [BookingLedgerInput]>(() =>
    Promise.resolve()
  );
  const recordReturnable = jest.fn<
    Promise<void>,
    [{ kind: string; refund: BookingPaymentRefund }]
  >(() => Promise.resolve());
  const platformLedger = {
    record,
    recordReturnable,
  } as unknown as BookingPlatformLedgerService;

  const queryBus = {
    execute: jest.fn(() => Promise.resolve({ data: missing })),
  } as unknown as TSQueryBus;

  return {
    handler: new BackfillBookingLedgerEntriesHandler(
      repo,
      refundRepo,
      platformTenant,
      policyFactory,
      platformLedger,
      queryBus
    ),
    record,
    recordReturnable,
    findById,
    findRefundById,
    check,
  };
};

const run = (handler: BackfillBookingLedgerEntriesHandler) =>
  handler.execute(
    new BackfillBookingLedgerEntriesCommand({
      data: {
        from: new Date('2026-09-01T00:00:00Z'),
        to: new Date('2026-09-30T23:59:59Z'),
      },
      ctx,
    })
  );

describe('BackfillBookingLedgerEntriesHandler', () => {
  it('eksik fişleri yazar ve sayar', async () => {
    const { handler, record } = build([view()]);

    const result = await run(handler);

    expect(result).toEqual({ attempted: 1, recorded: 1, failed: [] });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'SETTLED', provider: 'STRIPE' })
    );
  });

  it('yön SATIRDAN okunur — iade, tahsilat olarak yazılmaz; tarih ve kanal İADE satırından gelir', async () => {
    // §65'in dersi: tek tür varsayan telafi kodu ikinci türü sessizce birinciye çevirir ve
    // iade edilen parayı deftere ikinci kez gelir gibi geçirir.
    const refund = refundIn('CONFIRMED');
    const { handler, record } = build(
      [
        view({
          kind: 'REFUNDED',
          dedupeKey: 'platform-booking-refunded:bp-1',
          refundId: refund.id.value,
        }),
      ],
      {},
      refund
    );

    await run(handler);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'REFUNDED',
        provider: 'IYZICO',
        occurredAt: refund.refundedAt,
      })
    );
  });

  // P0-3: doğrulanmamış iade için ters fiş yazılamaz — liste de borçlu saymaz, ama liste
  // ile telafi arasında geçen sürede durum değişmiş olabilir; son söz yürütme anındaki satırdadır.
  it('DOĞRULANMAMIŞ iade için ters kayıt yazılmaz (liste bayatlasa bile)', async () => {
    const refund = refundIn('UNCONFIRMED');
    const { handler, record } = build(
      [view({ kind: 'REFUNDED', refundId: refund.id.value })],
      {},
      refund
    );

    const result = await run(handler);

    expect(record).not.toHaveBeenCalled();
    expect(result.recorded).toBe(0);
    expect(result.failed[0].reason).toContain('doğrulanmadı');
  });

  it('İade satırı bulunamazsa köprüye gidilmez', async () => {
    const { handler, record } = build(
      [view({ kind: 'REFUNDED', refundId: 'r-1' })],
      {},
      null
    );

    const result = await run(handler);

    expect(record).not.toHaveBeenCalled();
    expect(result.failed[0].reason).toContain('İade kaydı bulunamadı');
  });

  it('336 açılışı iade satırından yazılır (onaylanmasa da: para platform hesabına girdi)', async () => {
    const refund = refundIn('UNCONFIRMED', 'UNCLAIMED_CHARGE');
    const { handler, recordReturnable, record } = build(
      [view({ kind: 'RETURNABLE_RECEIVED', refundId: refund.id.value })],
      {},
      refund
    );

    const result = await run(handler);

    expect(result.recorded).toBe(1);
    expect(record).not.toHaveBeenCalled();
    expect(recordReturnable).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'RETURNABLE_RECEIVED', refund })
    );
  });

  it('336 kapanışı yalnız ONAYLANMIŞ iade için yazılır', async () => {
    const refund = refundIn('UNCONFIRMED', 'UNCLAIMED_CHARGE');
    const { handler, recordReturnable } = build(
      [view({ kind: 'RETURNABLE_REFUNDED', refundId: refund.id.value })],
      {},
      refund
    );

    const result = await run(handler);

    expect(recordReturnable).not.toHaveBeenCalled();
    expect(result.failed[0].reason).toContain('doğrulanmadı');
  });

  it('bir hareket patlasa tur DURMAZ, kalanlar yazılır', async () => {
    const { handler, record } = build([
      view({ bookingPaymentId: 'bp-1' }),
      view({ bookingPaymentId: 'bp-2' }),
    ]);
    record.mockImplementationOnce(() => Promise.reject(new Error('db down')));

    const result = await run(handler);

    expect(result.attempted).toBe(2);
    expect(result.recorded).toBe(1);
    expect(result.failed).toEqual([
      { bookingPaymentId: 'bp-1', kind: 'SETTLED', reason: 'db down' },
    ]);
  });

  it('yazılamayan fiş (muhasebe kararı bekleyen) gerekçesiyle döner', async () => {
    // Yeniden denemeyle çözülmeyen hâl: operatör "tekrar dene" ile "karar ver"i
    // ayırt edebilsin diye gerekçe metni taşınıyor.
    const refund = refundIn('CONFIRMED');
    const { handler, record } = build(
      [view({ kind: 'REFUNDED', refundId: refund.id.value })],
      {},
      refund
    );
    record.mockImplementationOnce(() =>
      Promise.reject(
        new BookingLedgerNotPostableException({
          bookingPaymentId: 'bp-1',
          reason: 'BELOW_COST',
          refundAmount: '120.00',
          supplierPosted: '130.00',
          retainedLoss: '0.00',
        })
      )
    );

    const result = await run(handler);

    expect(result.recorded).toBe(0);
    expect(result.failed[0].reason).toContain('maliyetin altında satış');
  });

  it('kayıt bulunamazsa köprüye gidilmez', async () => {
    const { handler, record } = build([view()], { 'bp-1': null });

    const result = await run(handler);

    expect(record).not.toHaveBeenCalled();
    expect(result.failed[0].reason).toContain('bulunamadı');
  });

  it('tahsilat kanalı boşsa fiş uydurulmaz', async () => {
    // `provider` fiş açıklamasını besliyor; varsayılan atamak "hangi kanaldan
    // tahsil edildi" sorusuna uydurma cevap yazmak olurdu.
    const pendingBp = BookingPayment.create(props);
    const { handler, record } = build([view()], { 'bp-1': pendingBp });

    const result = await run(handler);

    expect(record).not.toHaveBeenCalled();
    expect(result.failed[0].reason).toContain('paidProvider');
  });

  it('kayıt COMMAND repo’dan yüklenir (bayat tutarla fiş yazılmasın)', async () => {
    const { handler, findById } = build([view()]);

    await run(handler);

    expect(findById).toHaveBeenCalledWith('bp-1');
  });

  it('yetki PLATFORM kiracısı üzerinden değerlendirilir', async () => {
    const { handler, check } = build([view()]);

    await run(handler);

    const seen: string[] = [];
    check.mock.calls[0][0]({
      canAccessClinicFinances: (id: string) => {
        seen.push(id);
        return true;
      },
    });
    expect(seen).toEqual([PLATFORM_CLINIC]);
  });
});
