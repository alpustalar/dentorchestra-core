import { http, HttpResponse } from 'msw';

type ClinicAppointmentSettings = {
  clinicId: string;
  allowPatientBooking: boolean;
  rescheduleLimitHours: number;
  cancelLimitHours: number;
  allowPatientCancel: boolean;
  requireConfirmation: boolean;
  maxActivePatientBookings: number;
  maxFutureBookingDays: number;
  slotDurationMinutes: number;
  staffAllowOverbooking: boolean;
  sendSmsReminderHours: number;
  requireReminderResponse: boolean;
};

const defaultSettings = (clinicId: string): ClinicAppointmentSettings => ({
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
});

const settingsByClinic = new Map<string, ClinicAppointmentSettings>();

function getSettings(clinicId: string) {
  const current = settingsByClinic.get(clinicId);
  if (current) return current;

  const settings = defaultSettings(clinicId);
  settingsByClinic.set(clinicId, settings);
  return settings;
}

export const getClinicAppointmentSettingsMockHandler = () =>
  http.get('*/api/v1/clinics/:id/appointment-settings', ({ params }) => {
    const clinicId = String(params.id);
    return HttpResponse.json({ data: getSettings(clinicId) });
  });

export const updateClinicAppointmentSettingsMockHandler = () =>
  http.patch(
    '*/api/v1/clinics/:id/appointment-settings',
    async ({ params, request }) => {
      const clinicId = String(params.id);
      const current = getSettings(clinicId);
      const update =
        (await request.json()) as Partial<ClinicAppointmentSettings>;
      const next = { ...current, ...update, clinicId };
      settingsByClinic.set(clinicId, next);
      return new HttpResponse(null, { status: 200 });
    }
  );

export const getClinicAppointmentSettingsMocks = () => [
  getClinicAppointmentSettingsMockHandler(),
  updateClinicAppointmentSettingsMockHandler(),
];
