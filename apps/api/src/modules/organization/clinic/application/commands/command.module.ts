import { UpdateClinicHandler } from './update-clinic/update-clinic.handler';
import { SoftDeleteManyClinicsByOrganizationIdHandler } from './soft-delete-many-clinics-by-organization-id/soft-delete-many-clinics-by-organization-id.handler';
import { Module } from '@nestjs/common';
import { CreateClinicHandler } from './create-clinic/create-clinic.handler';
import { SoftDeleteClinicHandler } from './soft-delete-clinic/soft-delete-clinic.handler';
import { UpdateClinicAppointmentSettingsHandler } from './update-clinic-appointment-settings/update-clinic-appointment-settings.handler';
import { SetClinicBusinessTypeHandler } from './set-clinic-business-type/set-clinic-business-type.handler';
import { ClinicCacheService } from '@modules/organization/clinic/infrastructure/cache/clinic-cache.service';
import { ClinicInfrastructureModule } from '@modules/organization/clinic/infrastructure/infrastructure.module';

const CommandHandlers = [
  UpdateClinicHandler,
  SoftDeleteManyClinicsByOrganizationIdHandler,
  CreateClinicHandler,
  SoftDeleteClinicHandler,
  UpdateClinicAppointmentSettingsHandler,
  SetClinicBusinessTypeHandler,
];

@Module({
  imports: [ClinicInfrastructureModule],
  providers: [...CommandHandlers, ClinicCacheService],
  exports: [...CommandHandlers],
})
export class ClinicCommandModule {}
