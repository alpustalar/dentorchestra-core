'use client';

import { useQuery } from '@tanstack/react-query';

import { orvalMutator } from '@/lib/api/orval-mutator';
import { getMockClinicAppointmentSettings } from './mock-clinic-appointment-settings';
import { OFFLINE_QUERY_CACHE_MAX_AGE } from '@/lib/query';

export interface ClinicAppointmentSettings {
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
}

type ClinicAppointmentSettingsResponse = { data: ClinicAppointmentSettings };

export const clinicAppointmentSettingsQueryKey = (clinicId: string) =>
  ['clinicAppointmentSettings', clinicId] as const;

export function useClinicAppointmentSettings(clinicId: string) {
  const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

  return useQuery({
    queryKey: clinicAppointmentSettingsQueryKey(clinicId),
    enabled: Boolean(clinicId),
    gcTime: OFFLINE_QUERY_CACHE_MAX_AGE,
    meta: { persist: true },
    queryFn: async () => {
      if (mockingEnabled) {
        return { data: getMockClinicAppointmentSettings(clinicId) };
      }

      return orvalMutator<ClinicAppointmentSettingsResponse>({
        url: `/api/v1/clinics/${clinicId}/appointment-settings`,
        method: 'GET',
      });
    },
  });
}
