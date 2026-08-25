import { Module } from '@nestjs/common';
import { DuffelFlightBookingCommandRepository } from './duffel-flight-booking.command.repository';
import { DuffelFlightBookingQueryRepository } from './duffel-flight-booking.query.repository';
import { DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.query.repository';

@Module({
  providers: [
    {
      provide: DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
      useClass: DuffelFlightBookingCommandRepository,
    },
    {
      provide: DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY,
      useClass: DuffelFlightBookingQueryRepository,
    },
  ],
  exports: [
    DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
    DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY,
  ],
})
export class DuffelFlightBookingRepositoryModule {}
