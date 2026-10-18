import { Module } from '@nestjs/common';
import { ClinicPresentationModule } from '@modules/organization/clinic/presentation/presentation.module';
import { ClinicDomainServicesModule } from '@modules/organization/clinic/domain/services/services.module';
import { ClinicCommandModule } from '@modules/organization/clinic/application/commands/command.module';
import { ClinicQueryModule } from '@modules/organization/clinic/application/queries/query.module';
import { ClinicEventModule } from '@modules/organization/clinic/infrastructure/messaging/events/clinic-event.module';

@Module({
  imports: [
    ClinicPresentationModule,
    ClinicDomainServicesModule,
    ClinicCommandModule,
    ClinicQueryModule,
    ClinicEventModule,
  ],
  exports: [ClinicDomainServicesModule],
})
export class ClinicModule {}
