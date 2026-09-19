import { Module } from '@nestjs/common';
import { FlightRepositoriesModule } from '@modules/crm/health-tourism/flight/infrastructure/persistence/prisma/repositories/repositories.module';
import { FlightCacheModule } from '@modules/crm/health-tourism/flight/infrastructure/cache/flight-cache.module';
import { DuffelApiModule } from '@modules/crm/health-tourism/flight/infrastructure/adapters/duffel/duffel-api.module';

const InfrastructureModules = [
  FlightRepositoriesModule,
  FlightCacheModule,
  DuffelApiModule,
];

@Module({
  imports: [...InfrastructureModules],
  exports: [...InfrastructureModules],
})
export class FlightInfrastructureModule {}
