import { Module } from '@nestjs/common';
import { FLIGHT_CACHE_SERVICE } from '@modules/crm/health-tourism/flight/domain/interfaces/flight-cache.service.interface';
import { FlightCacheService } from './flight-cache.service';

@Module({
  providers: [{ provide: FLIGHT_CACHE_SERVICE, useClass: FlightCacheService }],
  exports: [FLIGHT_CACHE_SERVICE],
})
export class FlightCacheModule {}
