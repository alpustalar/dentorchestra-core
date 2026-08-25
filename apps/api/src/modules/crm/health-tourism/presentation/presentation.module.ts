import { Module } from '@nestjs/common';
import { HealthTourismQueryController } from '@modules/crm/health-tourism/presentation/http/controllers/health-tourism.query.controller';
import { HealthTourismCommandController } from '@modules/crm/health-tourism/presentation/http/controllers/health-tourism.command.controller';
import { HotelModule } from '../hotel/hotel.module';
import { TransferModule } from '../transfer/transfer.module';
import { FlightModule } from '../flight/flight.module';

@Module({
  imports: [HotelModule, TransferModule, FlightModule],
  controllers: [HealthTourismQueryController, HealthTourismCommandController],
})
export class HealthTourismPresentationModule {}
