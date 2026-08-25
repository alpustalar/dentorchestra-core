import { Module } from '@nestjs/common';
import { ClinicHealthTourismConfigQueryController } from '@modules/crm/health-tourism/config/presentation/http/controllers/clinic-health-tourism-config.query.controller';
import { ClinicHealthTourismConfigCommandController } from '@modules/crm/health-tourism/config/presentation/http/controllers/clinic-health-tourism-config.command.controller';
import { HealthTourismConfigCommandModule } from '@modules/crm/health-tourism/config/application/commands/command.module';
import { HealthTourismConfigQueryModule } from '@modules/crm/health-tourism/config/application/queries/query.module';

@Module({
  imports: [HealthTourismConfigCommandModule, HealthTourismConfigQueryModule],
  controllers: [
    ClinicHealthTourismConfigQueryController,
    ClinicHealthTourismConfigCommandController,
  ],
})
export class HealthTourismConfigPresentationModule {}
