import type { Appointment } from '@shared/generated-zod';

/** Calendar/list fields only; serialized HTTP records are not database entities. */
export type CalendarAppointment = Pick<
  Appointment,
  | 'id'
  | 'status'
  | 'startTime'
  | 'endTime'
  | 'patientId'
  | 'patientName'
  | 'providerId'
  | 'clinicId'
> & { treatmentId?: string | null };

export function canResizeCalendarAppointment(appointment: CalendarAppointment) {
  return !['CANCELLED', 'COMPLETED', 'NOSHOW'].includes(appointment.status);
}
