'use client';

import { useQuery } from '@tanstack/react-query';
import { appointmentEndpoints } from '@core-crm/shared/client';
import dayjs from 'dayjs';

import { api } from '@/lib/api';

import type { AppointmentStatus } from '../appointment.types';
import { appointmentKeys } from './appointment.keys';
import { OFFLINE_QUERY_CACHE_MAX_AGE } from '@/lib/query';

interface UseAppointmentDayParams {
  clinicId: string;
  /** 'YYYY-MM-DD' — klinik yerel günü. */
  date: string;
  providerId?: string;
  status?: AppointmentStatus;
}

/**
 * Günün ajandası. `list` yerine `calendar` uçtan çekiliyor: liste ham
 * `Appointment` döner, takvim ucu ise doktor adıyla zenginleştirilmiş okuma
 * modeli (`ClinicCalendarEvent`) — ekranda gösterilen tam olarak o.
 *
 * Aralık tek gün: `[00:00, 24:00)`. Sunucu randevuyu başlangıç zamanına göre
 * aralığa alıp klinik yerelinde güne grupladığı için tek elemanlı bir dizi döner.
 */
export function useAppointmentDay({
  clinicId,
  date,
  providerId,
  status,
}: UseAppointmentDayParams) {
  return useQuery({
    queryKey: appointmentKeys.day(clinicId, date, { providerId, status }),
    gcTime: OFFLINE_QUERY_CACHE_MAX_AGE,
    meta: { persist: true },
    queryFn: async ({ signal }) => {
      const days = await api(appointmentEndpoints.calendar, {
        query: {
          clinicId,
          startDate: dayjs(date).startOf('day').toDate(),
          endDate: dayjs(date).endOf('day').toDate(),
          providerId,
          status,
        },
        signal,
      });

      // Gün boşsa sunucu o günü hiç döndürmez; ekranın "kayıt yok" durumunu
      // gösterebilmesi için boş bir olay listesine indirgiyoruz.
      return days.find((day) => day.date === date)?.events ?? [];
    },
  });
}

export function useAppointmentDailySummary({
  clinicId,
  date,
  providerId,
}: Omit<UseAppointmentDayParams, 'status'>) {
  return useQuery({
    queryKey: appointmentKeys.summary(clinicId, date, providerId),
    gcTime: OFFLINE_QUERY_CACHE_MAX_AGE,
    meta: { persist: true },
    queryFn: ({ signal }) =>
      api(appointmentEndpoints.dailySummary, {
        query: {
          clinicId,
          date: dayjs(date).startOf('day').toDate(),
          providerId,
        },
        signal,
      }),
  });
}
