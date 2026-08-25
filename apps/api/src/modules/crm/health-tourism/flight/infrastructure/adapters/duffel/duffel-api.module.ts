import { Module } from '@nestjs/common';
import { DUFFEL_API_SERVICE } from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { DuffelApiService } from './duffel-api.service';

@Module({
  providers: [{ provide: DUFFEL_API_SERVICE, useClass: DuffelApiService }],
  exports: [DUFFEL_API_SERVICE],
})
export class DuffelApiModule {}
