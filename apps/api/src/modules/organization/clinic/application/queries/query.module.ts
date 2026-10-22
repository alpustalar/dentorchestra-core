import { FindClinicIdByProviderIdHandler } from './find-clinic-id-by-provider-id/find-clinic-id-by-provider-id.handler';
import { FindClinicIdByPatientIdHandler } from './find-clinic-id-by-patient-id/find-clinic-id-by-patient-id.handler';
import { GetClinicScheduleHandler } from './get-clinic-schedule/get-clinic-schedule.handler';
import { FindManyByOrganizationIdHandler } from './find-many-by-organization-id/find-many-by-organization-id.handler';
import { Module } from '@nestjs/common';
import { FindClinicAvailabilityByDayHandler } from './find-clinic-availability-by-day/find-clinic-availability-by-day.handler';

import { GetClinicTimezoneHandler } from '@modules/organization/clinic/application/queries/get-clinic-timezone/get-clinic-timezone.handler';
import { GetClinicCurrencyHandler } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.handler';
import { GetClinicFinanceSettingsHandler } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.handler';
import { GetClinicOrganizationIdHandler } from '@modules/organization/clinic/application/queries/get-clinic-organization-id/get-clinic-organization-id.handler';
import { GetClinicAppointmentSettingsHandler } from '@modules/organization/clinic/application/queries/get-clinic-appointment-settings/get-clinic-appointment-settings.handler';
import { GetClinicEDocumentProfileHandler } from './get-clinic-edocument-profile/get-clinic-edocument-profile.handler';
import { ClinicInfrastructureModule } from '@modules/organization/clinic/infrastructure/infrastructure.module';

const QueryHandlers = [
  FindClinicIdByProviderIdHandler,
  FindClinicIdByPatientIdHandler,
  GetClinicScheduleHandler,
  FindManyByOrganizationIdHandler,
  FindClinicAvailabilityByDayHandler,
  GetClinicTimezoneHandler,
  GetClinicCurrencyHandler,
  GetClinicFinanceSettingsHandler,
  GetClinicOrganizationIdHandler,
  GetClinicAppointmentSettingsHandler,
  GetClinicEDocumentProfileHandler,
];

@Module({
  imports: [ClinicInfrastructureModule],
  providers: [...QueryHandlers],
})
export class ClinicQueryModule {}
