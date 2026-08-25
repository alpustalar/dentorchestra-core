import { Module } from '@nestjs/common';
import { HotelApplicationModule } from '@modules/crm/health-tourism/hotel/application/application.module';
import { HotelInfrastructureModule } from '@modules/crm/health-tourism/hotel/infrastructure/infrastructure.module';

@Module({
  imports: [HotelApplicationModule, HotelInfrastructureModule],
  exports: [HotelApplicationModule],
})
export class HotelModule {}
