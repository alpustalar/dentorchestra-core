import { Module } from '@nestjs/common';
import { FlightApplicationModule } from '@modules/crm/health-tourism/flight/application/application.module';
import { FlightInfrastructureModule } from '@modules/crm/health-tourism/flight/infrastructure/infrastructure.module';

/**
 * Sağlık turizminin uçuş dikeyi (Duffel). Otel/transfer HotelBeds'te kalır —
 * Duffel'ın yer transferi ürünü yoktur.
 */
@Module({
  imports: [FlightApplicationModule, FlightInfrastructureModule],
  exports: [FlightApplicationModule],
})
export class FlightModule {}
