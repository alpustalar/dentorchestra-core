import { Module } from '@nestjs/common';
import { FlightCommandModule } from '@modules/crm/health-tourism/flight/application/commands/command.module';
import { FlightQueryModule } from '@modules/crm/health-tourism/flight/application/queries/query.module';
import { FlightAiToolsModule } from '@modules/crm/health-tourism/flight/application/ai-tools/flight-ai-tools.module';

const ApplicationModules = [
  FlightCommandModule,
  FlightQueryModule,
  FlightAiToolsModule,
];

@Module({
  imports: [...ApplicationModules],
  exports: [...ApplicationModules],
})
export class FlightApplicationModule {}
