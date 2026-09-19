import { Decimal } from 'decimal.js';
import { PayHeldFlightHandler } from './pay-held-flight.handler';
import { PayHeldFlightCommand } from './pay-held-flight.command';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import {
  FlightOrderState,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import {
  FlightBookingNotFoundException,
  FlightHoldExpiredException,
  FlightPaymentInProgressException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { DuffelFlightBookingStatusType } from '@input-type-schemas/DuffelFlightBookingStatusSchema';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

const ctx: IGetContext = {
  actor: {
    userId: UUID.generate().value,
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    managedClinics: [{ id: CLINIC_ID }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.INTERNAL_CASCADE,
};

const makeBooking = (
  overrides: { mode?: 'HOLD' | 'INSTANT'; holdExpiresAt?: Date | null } = {}
) =>
  DuffelFlightBooking.create({
    duffelOrderId: 'ord_1',
    offerId: 'off_1',
    mode: overrides.mode ?? 'HOLD',
    passengers: [],
    slices: [],
    totalAmount: 349.9,
    currency: 'EUR',
    organizationId: ORG_ID,
    clinicId: CLINIC_ID,
    holdExpiresAt:
      overrides.holdExpiresAt ??
      DateTimeManager.addMinutes(DateTimeManager.create(), 30),
    actorId: ctx.actor.userId,
    logSource: LogSource.SYSTEM,
  });

/**
 * DB'den okunmuş gibi kayıt kurar. Kilitli/bayat claim senaryoları ancak
 * `paymentClaimedAt` geçmişe alınarak ifade edilebilir (alan private, setter yok).
 */
const makePersistedBooking = (overrides: {
  status: DuffelFlightBookingStatusType;
  paymentClaimedAt?: Date | null;
}) => {
  const now = DateTimeManager.create();
  return new DuffelFlightBooking({
    id: UUID.generate().value,
    organizationId: ORG_ID,
    clinicId: CLINIC_ID,
    patientId: null,
    leadId: null,
    duffelOrderId: 'ord_1',
    bookingReference: null,
    offerId: 'off_1',
    mode: 'HOLD',
    status: overrides.status,
    passengers: [],
    slices: [],
    totalAmount: new Decimal('349.90'),
    currency: 'EUR',
    holdExpiresAt: DateTimeManager.addMinutes(now, 30),
    paymentClaimedAt: overrides.paymentClaimedAt ?? null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  });
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

/** Mikro-görev kuyruğunu boşaltır; eşzamanlılık testlerinde sıra kurmak için. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

interface BuildOptions {
  payOrder?: () => Promise<void>;
  orderState?: FlightOrderState | null;
  getOrderStateThrows?: boolean;
}

const build = (
  booking: DuffelFlightBooking | null,
  options: BuildOptions = {}
) => {
  // Duffel çağrısının kilit içinde mi dışında mı yapıldığını ölçer: saniyeler süren
  // bir dış istek satır kilidini tutarsa eşzamanlı iptal/okuma bekler.
  let txDepth = 0;
  const depthAtCall: Record<string, number> = {};

  const duffelApi = {
    payOrder: jest.fn(async () => {
      depthAtCall.payOrder = txDepth;
      if (options.payOrder) await options.payOrder();
    }),
    getOrderState: jest.fn(async () => {
      depthAtCall.getOrderState = txDepth;
      if (options.getOrderStateThrows) throw new Error('duffel down');
      return options.orderState ?? null;
    }),
  } as unknown as IDuffelApiService;

  const repo = {
    findByIdForUpdate: jest.fn(async () => booking),
    update: jest.fn(async (e: DuffelFlightBooking) => e),
  } as unknown as IDuffelFlightBookingCommandRepository;

  // Satır kilidini taklit eder: `run` gövdeleri SIRAYLA çalışır, iç içe geçmez.
  let queue: Promise<unknown> = Promise.resolve();
  const txManager = {
    run: jest.fn((cb: () => Promise<unknown>) => {
      const next = queue.then(async () => {
        txDepth++;
        try {
          return await cb();
        } finally {
          txDepth--;
        }
      });
      queue = next.catch(() => undefined);
      return next;
    }),
  } as unknown as TransactionManager;

  return {
    handler: new PayHeldFlightHandler(duffelApi, repo, txManager),
    duffelApi,
    repo,
    depthAtCall,
  };
};

describe('PayHeldFlightHandler', () => {
  it('HELD kaydı öder ve CONFIRMED yapar', async () => {
    const booking = makeBooking();
    const { handler, duffelApi, repo } = build(booking);

    const result = await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(duffelApi.payOrder).toHaveBeenCalledWith({
      orderId: 'ord_1',
      amount: '349.90',
      currency: 'EUR',
    });
    expect(booking.status).toBe('CONFIRMED');
    expect(repo.update).toHaveBeenCalled();
    expect(result).toBe(booking.id.value);
  });

  it('zaten CONFIRMED kayda ikinci webhook düşerse Duffel’a tekrar ödeme GİTMEZ', async () => {
    // Çift-çekim koruması: Stripe retry veya iki link birden ödendiğinde
    // ikinci çağrı sessizce döner.
    const booking = makeBooking({ mode: 'INSTANT' });
    const { handler, duffelApi, repo } = build(booking);

    const result = await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(duffelApi.payOrder).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(result).toBe(booking.id.value);
  });

  it('hold süresi dolmuşsa ödeme denenmez (koltuk Duffel’da serbest bırakıldı)', async () => {
    const booking = makeBooking({
      holdExpiresAt: DateTimeManager.addMinutes(DateTimeManager.create(), -1),
    });
    const { handler, duffelApi } = build(booking);

    await expect(
      handler.execute(
        new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
      )
    ).rejects.toBeInstanceOf(FlightHoldExpiredException);

    expect(duffelApi.payOrder).not.toHaveBeenCalled();
  });

  it('kayıt yoksa FlightBookingNotFoundException', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(new PayHeldFlightCommand({ bookingId: 'yok', ctx }))
    ).rejects.toBeInstanceOf(FlightBookingNotFoundException);
  });

  it('Duffel ödeme çağrısı kilit DIŞINDA yapılır', async () => {
    const booking = makeBooking();
    const { handler, depthAtCall } = build(booking);

    await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(depthAtCall.payOrder).toBe(0);
  });
});

describe('PayHeldFlightHandler — eşzamanlılık', () => {
  it('iki eşzamanlı istekten yalnız BİRİ Duffel’a ödeme gönderir', async () => {
    // Regresyon: sahiplenme kalıcı yazılmadan önce iki istek de commit sonrası
    // kaydı HELD görüyor ve aynı bilet iki kez ödeniyordu.
    const booking = makeBooking();
    const gate = deferred();
    const { handler, duffelApi } = build(booking, {
      payOrder: () => gate.promise,
    });

    const command = new PayHeldFlightCommand({
      bookingId: booking.id.value,
      ctx,
    });

    const first = handler.execute(command);
    await settle(); // ilk istek claim'i alır ve ödemede bekler
    const second = handler.execute(command);

    await expect(second).rejects.toBeInstanceOf(
      FlightPaymentInProgressException
    );

    gate.resolve();
    await expect(first).resolves.toBe(booking.id.value);

    expect(duffelApi.payOrder).toHaveBeenCalledTimes(1);
    expect(booking.status).toBe('CONFIRMED');
  });

  it('ödeme sahiplenildiğinde kayıt PAYMENT_IN_PROGRESS olarak KALICI yazılır', async () => {
    const booking = makeBooking();
    const gate = deferred();
    const { handler, repo } = build(booking, { payOrder: () => gate.promise });

    const running = handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );
    await settle();

    expect(booking.status).toBe('PAYMENT_IN_PROGRESS');
    expect(booking.paymentClaimedAt).not.toBeNull();
    expect(repo.update).toHaveBeenCalled(); // claim commit edildi, sadece bellekte değil

    gate.resolve();
    await running;
  });
});

describe('PayHeldFlightHandler — yarıda kalmış ödeme (crash) mutabakatı', () => {
  const staleClaimedAt = () =>
    DateTimeManager.subtractMinutes(DateTimeManager.create(), 10);

  it('bayat claim + sağlayıcıda ödenmiş → TEKRAR ÖDENMEZ, doğrudan onaylanır', async () => {
    // Regresyon: Duffel ödemesi geçip DB yazımı çökerse kayıt PAYMENT_IN_PROGRESS
    // kalır; retry körlemesine ikinci kez ödemeye çalışırdı.
    const booking = makePersistedBooking({
      status: 'PAYMENT_IN_PROGRESS',
      paymentClaimedAt: staleClaimedAt(),
    });
    const { handler, duffelApi } = build(booking, {
      orderState: {
        orderId: 'ord_1',
        bookingReference: 'PNR123',
        isPaid: true,
        isCancelled: false,
      },
    });

    await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(duffelApi.payOrder).not.toHaveBeenCalled();
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.bookingReference).toBe('PNR123');
  });

  it('bayat claim + sağlayıcıda ödenmemiş → ödeme yeniden denenir', async () => {
    const booking = makePersistedBooking({
      status: 'PAYMENT_IN_PROGRESS',
      paymentClaimedAt: staleClaimedAt(),
    });
    const { handler, duffelApi } = build(booking, {
      orderState: {
        orderId: 'ord_1',
        bookingReference: null,
        isPaid: false,
        isCancelled: false,
      },
    });

    await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(duffelApi.payOrder).toHaveBeenCalledTimes(1);
    expect(booking.status).toBe('CONFIRMED');
  });

  it('TAZE claim devralınmaz — canlı deneme sürüyor olabilir', async () => {
    const booking = makePersistedBooking({
      status: 'PAYMENT_IN_PROGRESS',
      paymentClaimedAt: DateTimeManager.create(),
    });
    const { handler, duffelApi } = build(booking);

    await expect(
      handler.execute(
        new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
      )
    ).rejects.toBeInstanceOf(FlightPaymentInProgressException);

    expect(duffelApi.payOrder).not.toHaveBeenCalled();
    expect(duffelApi.getOrderState).not.toHaveBeenCalled();
  });
});

describe('PayHeldFlightHandler — ödeme hatası sonrası mutabakat', () => {
  it('hata gelse de sağlayıcı “ödendi” diyorsa kayıt CONFIRMED olur (hata yutulur)', async () => {
    // Kopan bağlantı / zaman aşımı: istek ulaşmış, cevap dönmemiş olabilir.
    const booking = makeBooking();
    const { handler } = build(booking, {
      payOrder: () => Promise.reject(new Error('socket hang up')),
      orderState: {
        orderId: 'ord_1',
        bookingReference: 'PNR9',
        isPaid: true,
        isCancelled: false,
      },
    });

    await handler.execute(
      new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
    );

    expect(booking.status).toBe('CONFIRMED');
  });

  it('sağlayıcı “ödenmedi” diyorsa claim bırakılır (HELD) ve hata fırlar', async () => {
    const booking = makeBooking();
    const { handler } = build(booking, {
      payOrder: () => Promise.reject(new Error('insufficient balance')),
      orderState: {
        orderId: 'ord_1',
        bookingReference: null,
        isPaid: false,
        isCancelled: false,
      },
    });

    await expect(
      handler.execute(
        new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
      )
    ).rejects.toThrow('insufficient balance');

    // Tekrar denenebilir olmalı.
    expect(booking.status).toBe('HELD');
    expect(booking.paymentClaimedAt).toBeNull();
  });

  it('sağlayıcıya ulaşılamazsa kayıt PAYMENT_IN_PROGRESS BIRAKILIR (körlemesine HELD’e dönmez)', async () => {
    // HELD'e döndürmek, ödeme aslında geçtiyse ikinci çekim demektir.
    const booking = makeBooking();
    const { handler } = build(booking, {
      payOrder: () => Promise.reject(new Error('timeout')),
      getOrderStateThrows: true,
    });

    await expect(
      handler.execute(
        new PayHeldFlightCommand({ bookingId: booking.id.value, ctx })
      )
    ).rejects.toThrow('timeout');

    expect(booking.status).toBe('PAYMENT_IN_PROGRESS');
  });
});
