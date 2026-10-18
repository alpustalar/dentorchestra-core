import { Module } from '@nestjs/common';

import { PatientRepositoryModule } from '@modules/crm/patient/infrastructure/persistence/prisma/repositories/patient/patient.repository.module';
import { CreatePatientHandler } from '@modules/crm/patient/application/commands/create-patient/create-patient.handler';
import { LinkFirebaseAccountHandler } from '@modules/crm/patient/application/commands/link-firebase-account/link-firebase-account.handler';

const Handlers = [CreatePatientHandler, LinkFirebaseAccountHandler];

@Module({
  imports: [PatientRepositoryModule],
  providers: Handlers,
  exports: Handlers,
})
export class PatientCommandModule {}
