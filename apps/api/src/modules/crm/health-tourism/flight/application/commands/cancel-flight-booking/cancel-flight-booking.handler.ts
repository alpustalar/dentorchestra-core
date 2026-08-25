import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { CancelFlightBookingCommand } from './cancel-flight-booking.command';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
  IDuffelFlightBookingCommandRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { FlightBookingNotFoundException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(CancelFlightBookingCommand)
export class CancelFlightBookingHandler implements ICommandHandler<
  CancelFlightBookingCommand,
  void
> {
  private readonly logger = new Logger(CancelFlightBookingHandler.name);

  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService,
    @Inject(DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CancelFlightBookingCommand): Promise<void> {
    const { data, ctx } = command;

    // Önce kilitli claim, sonra dış çağrı: sıralama otel/transferdeki ile aynı
    // gerekçeye dayanır — iki eşzamanlı iptal isteğinden ikincisi kaydı zaten
    // CANCELLED görür ve Duffel'a ikinci iptal (ve ikinci iade) gitmez.
    const claimed = await this.txManager.run(async () => {
      const booking = await this.flightBookingRepo.findByIdForUpdate(
        data.bookingId
      );
      if (!booking) throw new FlightBookingNotFoundException(data.bookingId);

      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanAccessTargetClinic(booking.clinicId.value)
        )
        .orThrow('health-tourism.flight');

      if (booking.validate.status.isCancelled.value) return null;

      booking.cancel({
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
        reason: data.reason,
      });
      await this.flightBookingRepo.update(booking);

      return booking;
    });

    if (!claimed) {
      this.logger.log(
        `Uçuş rezervasyonu zaten iptal edilmiş, Duffel'a tekrar gidilmedi: ${data.bookingId}`
      );
      return;
    }

    await this.duffelApi.cancelOrder(claimed.duffelOrderId);
  }
}
