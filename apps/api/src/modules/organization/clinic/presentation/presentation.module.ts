import { Module } from '@nestjs/common';
import {
  ClinicAdminCommandController,
  ClinicCommandController,
  ClinicQueryController,
} from '@modules/organization/clinic/presentation/http/controllers';

@Module({
  controllers: [
    ClinicAdminCommandController,
    ClinicCommandController,
    ClinicQueryController,
  ],
})
export class ClinicPresentationModule {}
