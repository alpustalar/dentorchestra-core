import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { FlightInfrastructureModule } from '@modules/crm/health-tourism/flight/infrastructure/infrastructure.module';
import { HoldFlightHandler } from './hold-flight/hold-flight.handler';
import { PayHeldFlightHandler } from './pay-held-flight/pay-held-flight.handler';
import { BookFlightHandler } from './book-flight/book-flight.handler';
import { CancelFlightBookingHandler } from './cancel-flight-booking/cancel-flight-booking.handler';
import { CacheFlightOfferHandler } from './cache-flight-offer/cache-flight-offer.handler';

export const FLIGHT_COMMAND_HANDLERS = [
  HoldFlightHandler,
  PayHeldFlightHandler,
  BookFlightHandler,
  CancelFlightBookingHandler,
  CacheFlightOfferHandler,
];

@Module({
  imports: [CqrsModule, FlightInfrastructureModule],
  providers: FLIGHT_COMMAND_HANDLERS,
  exports: FLIGHT_COMMAND_HANDLERS,
})
export class FlightCommandModule {}
