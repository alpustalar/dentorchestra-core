import { PayHeldFlightHandler } from './pay-held-flight.handler';
import { PayHeldFlightCommand } from './pay-held-flight.command';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import { IDuffelApiService } from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import {
  FlightBookingNotFoundException,
  FlightHoldExpiredException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

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

const build = (booking: DuffelFlightBooking | null) => {
  // Duffel çağrısının kilit içinde mi dışında mı yapıldığını ölçer: saniyeler süren
  // bir dış istek satır kilidini tutarsa eşzamanlı iptal/okuma bekler.
  let txDepth = 0;
  const depthAtCall: Record<string, number> = {};

  const duffelApi = {
    payOrder: jest.fn(async () => {
      depthAtCall.payOrder = txDepth;
    }),
  } as unknown as IDuffelApiService;

  const repo = {
    findByIdForUpdate: jest.fn(async () => booking),
    update: jest.fn(async (e: DuffelFlightBooking) => e),
  } as unknown as IDuffelFlightBookingCommandRepository;

  const txManager = {
    run: jest.fn(async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
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
