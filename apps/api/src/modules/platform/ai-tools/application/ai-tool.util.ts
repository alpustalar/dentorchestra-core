import { ExecutionSources } from '../../../../../../../packages/shared/common/constants/execution-source.constant';
import {
  AppointmentStatusSchema,
  AppointmentStatusType as AppointmentStatus,
} from '@input-type-schemas/AppointmentStatusSchema';
import { IGetPatientContext } from '@common/decorators/get-patient-context.decorator';

/** Randevu statüsü "aktif" mi (iptal/tamamlandı/gelmedi değil)? */
export function isActiveAppointmentStatus(status: AppointmentStatus): boolean {
  const inactive: AppointmentStatus[] = [
    AppointmentStatusSchema.enum.CANCELLED,
    AppointmentStatusSchema.enum.COMPLETED,
    AppointmentStatusSchema.enum.NOSHOW,
  ];
  return !inactive.includes(status);
}

/** Hasta-kapsamlı actor context üretir (patient-cancel gibi hasta kaynaklı komutlar için). */
export function createPatientActorContext({
  phone,
  patientId,
  organizationId,
  clinicId,
  firstName,
}: {
  phone: string;
  patientId: string;
  organizationId: string;
  clinicId: string;
  firstName: string;
}): IGetPatientContext {
  return {
    actor: { phone, patientId, organizationId, clinicId, firstName },
    source: ExecutionSources.AI_EXECUTION,
  };
}
