import { CancelFlightBookingHandler } from './cancel-flight-booking.handler';
import { CancelFlightBookingCommand } from './cancel-flight-booking.command';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import { IDuffelApiService } from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { FlightBookingNotFoundException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CancelFlightBookingDto } from '@shared/modules/health-tourism/dto/commands';

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
  source: ExecutionSources.USER_ACTION,
};

const makeBooking = () =>
  DuffelFlightBooking.create({
    duffelOrderId: 'ord_1',
    offerId: 'off_1',
    mode: 'INSTANT',
    passengers: [],
    slices: [],
    totalAmount: 100,
    currency: 'EUR',
    organizationId: ORG_ID,
    clinicId: CLINIC_ID,
    actorId: ctx.actor.userId,
    logSource: LogSource.SYSTEM,
  });

const build = (booking: DuffelFlightBooking | null) => {
  let txDepth = 0;
  const depthAtCall: Record<string, number> = {};

  const duffelApi = {
    cancelOrder: jest.fn(async () => {
      depthAtCall.cancelOrder = txDepth;
      return {
        cancellationId: 'can_1',
        refundAmount: null,
        refundCurrency: null,
      };
    }),
  } as unknown as IDuffelApiService;

  const repo = {
    findByIdForUpdate: jest.fn(async () => booking),
    update: jest.fn(async (e: DuffelFlightBooking) => e),
  } as unknown as IDuffelFlightBookingCommandRepository;

  const policyFactory = {
    clinic: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
      },
    }),
  } as unknown as IPolicyFactory;

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
    handler: new CancelFlightBookingHandler(
      duffelApi,
      repo,
      policyFactory,
      txManager
    ),
    duffelApi,
    repo,
    depthAtCall,
  };
};

const dto = (bookingId: string) =>
  ({ bookingId, reason: 'hasta talebi' }) as CancelFlightBookingDto;

describe('CancelFlightBookingHandler', () => {
  it('kaydı iptal eder ve Duffel siparişini iptal eder', async () => {
    const booking = makeBooking();
    const { handler, duffelApi, repo } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(booking.status).toBe('CANCELLED');
    expect(repo.update).toHaveBeenCalled();
    expect(duffelApi.cancelOrder).toHaveBeenCalledWith('ord_1');
  });

  it('zaten iptal edilmiş kayıtta Duffel’a ikinci iptal GİTMEZ (çift iade önlenir)', async () => {
    const booking = makeBooking();
    booking.cancel({ actorId: ctx.actor.userId, logSource: LogSource.SYSTEM });

    const { handler, duffelApi, repo } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(duffelApi.cancelOrder).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('Duffel iptal çağrısı kilit DIŞINDA yapılır', async () => {
    const booking = makeBooking();
    const { handler, depthAtCall } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(depthAtCall.cancelOrder).toBe(0);
  });

  it('kayıt yoksa FlightBookingNotFoundException', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(
        new CancelFlightBookingCommand(
          dto('00000000-0000-4000-8000-000000000000'),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(FlightBookingNotFoundException);
  });
});
