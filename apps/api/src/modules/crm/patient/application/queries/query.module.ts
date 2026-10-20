import { Module } from '@nestjs/common';
import { FindPatientByContactHandler } from './find-patient-by-contact/find-patient-by-contact.handler';
import { GetPatientsHandler } from './get-patients/get-patients.handler';
import { GetPatientByIdHandler } from './get-patient-by-id/get-patient-by-id.handler';
import { FindPatientByFirebaseUidHandler } from './find-patient-by-firebase-uid/find-patient-by-firebase-uid.handler';
import { PatientRepositoryModule } from '@modules/crm/patient/infrastructure/persistence/prisma/repositories/patient/patient.repository.module';

const QueryHandlers = [
  FindPatientByContactHandler,
  GetPatientsHandler,
  GetPatientByIdHandler,
  FindPatientByFirebaseUidHandler,
];

@Module({
  imports: [PatientRepositoryModule],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class PatientQueryModule {}
