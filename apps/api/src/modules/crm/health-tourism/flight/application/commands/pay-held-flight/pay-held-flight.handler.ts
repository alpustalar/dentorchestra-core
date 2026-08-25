import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { PayHeldFlightCommand } from './pay-held-flight.command';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
  IDuffelFlightBookingCommandRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import {
  FlightBookingNotFoundException,
  FlightHoldExpiredException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';

@CommandHandler(PayHeldFlightCommand)
export class PayHeldFlightHandler implements ICommandHandler<
  PayHeldFlightCommand,
  string
> {
  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService,
    @Inject(DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: PayHeldFlightCommand): Promise<string> {
    const { bookingId, ctx } = command.payload;

    // Kilitli okuma: ödeme webhook'u iki kez düşerse (Stripe retry, çift link)
    // ikinci istek burada bekler ve HELD olmayan kaydı ikinci kez ödemeye çalışmaz.
    const { booking, alreadyConfirmed } = await this.txManager.run(async () => {
      const locked = await this.flightBookingRepo.findByIdForUpdate(bookingId);
      if (!locked) throw new FlightBookingNotFoundException(bookingId);

      // Zaten onaylanmışsa bu mükerrer bir çağrıdır; Duffel'a ikinci ödeme gitmez.
      if (locked.validate.status.isConfirmed.value) {
        return { booking: locked, alreadyConfirmed: true };
      }

      if (locked.isHoldExpired) {
        throw new FlightHoldExpiredException(
          locked.holdExpiresAt?.toISOString() ?? ''
        );
      }

      return { booking: locked, alreadyConfirmed: false };
    });

    if (alreadyConfirmed) return booking.id.value;

    // Duffel çağrısı bilerek kilit DIŞINDA: saniyeler sürebilen bir dış istek
    // satırı kilitli tutarsa eşzamanlı iptal/okuma bekler.
    await this.duffelApi.payOrder({
      orderId: booking.duffelOrderId,
      amount: booking.totalAmount.value.toFixed(2),
      currency: booking.totalAmount.currency,
    });

    await this.txManager.run(async () => {
      const fresh = await this.flightBookingRepo.findByIdForUpdate(bookingId);
      if (!fresh) throw new FlightBookingNotFoundException(bookingId);
      if (fresh.validate.status.isConfirmed.value) return;

      fresh.confirm({
        bookingReference: fresh.bookingReference,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });
      await this.flightBookingRepo.update(fresh);
    });

    return booking.id.value;
  }
}
