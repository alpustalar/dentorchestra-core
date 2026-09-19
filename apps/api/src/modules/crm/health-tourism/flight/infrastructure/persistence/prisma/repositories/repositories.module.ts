import { Module } from '@nestjs/common';
import { DuffelFlightBookingRepositoryModule } from '@modules/crm/health-tourism/flight/infrastructure/persistence/prisma/repositories/duffel-flight-booking/duffel-flight-booking.repository.module';

const RepositoriesModules = [DuffelFlightBookingRepositoryModule];
@Module({
  imports: [...RepositoriesModules],
  exports: [...RepositoriesModules],
})
export class FlightRepositoriesModule {}
