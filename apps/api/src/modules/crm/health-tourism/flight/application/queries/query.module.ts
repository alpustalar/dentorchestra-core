import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { FlightInfrastructureModule } from '@modules/crm/health-tourism/flight/infrastructure/infrastructure.module';
import { SearchFlightOffersHandler } from './search-flight-offers/search-flight-offers.handler';
import { GetFlightOfferHandler } from './get-flight-offer/get-flight-offer.handler';
import { GetFlightBookingsHandler } from './get-flight-bookings/get-flight-bookings.handler';
import { GetFlightBookingByIdHandler } from './get-flight-booking-by-id/get-flight-booking-by-id.handler';
import { QuoteOptionModule } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.module';

export const FLIGHT_QUERY_HANDLERS = [
  SearchFlightOffersHandler,
  GetFlightOfferHandler,
  GetFlightBookingsHandler,
  GetFlightBookingByIdHandler,
];

@Module({
  imports: [CqrsModule, FlightInfrastructureModule, QuoteOptionModule],
  providers: [...FLIGHT_QUERY_HANDLERS],
  exports: [...FLIGHT_QUERY_HANDLERS],
})
export class FlightQueryModule {}
