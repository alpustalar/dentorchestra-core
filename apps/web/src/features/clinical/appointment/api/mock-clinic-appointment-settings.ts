import type { ClinicAppointmentSettings } from './use-clinic-appointment-settings';

export const mockClinicAppointmentSettings = new Map<
  string,
  ClinicAppointmentSettings
>();

export function getMockClinicAppointmentSettings(clinicId: string) {
  const current = mockClinicAppointmentSettings.get(clinicId);
  if (current) return current;

  const settings: ClinicAppointmentSettings = {
    clinicId,
    allowPatientBooking: true,
    rescheduleLimitHours: 6,
    cancelLimitHours: 24,
    allowPatientCancel: true,
    requireConfirmation: false,
    maxActivePatientBookings: 3,
    maxFutureBookingDays: 90,
    slotDurationMinutes: 30,
    staffAllowOverbooking: true,
    sendSmsReminderHours: 24,
    requireReminderResponse: false,
  };
  mockClinicAppointmentSettings.set(clinicId, settings);
  return settings;
}
