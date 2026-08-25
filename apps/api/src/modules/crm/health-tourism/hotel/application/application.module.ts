import { Module } from '@nestjs/common';
import { HotelCommandModule } from '@modules/crm/health-tourism/hotel/application/commands/command.module';
import { HotelQueryModule } from '@modules/crm/health-tourism/hotel/application/queries/query.module';
import { HotelAiToolsModule } from '@modules/crm/health-tourism/hotel/application/ai-tools/hotel-ai-tools.module';

const ApplicationModules = [
  HotelCommandModule,
  HotelQueryModule,
  HotelAiToolsModule,
];

@Module({
  imports: [...ApplicationModules],
  exports: [...ApplicationModules],
})
export class HotelApplicationModule {}
