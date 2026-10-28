'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  appointmentEndpoints,
  type CancelAppointment,
  type ScheduleAppointment,
} from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { appointmentKeys } from './appointment.keys';

/**
 * Durum geçişleri gövdesizdir; hangi geçiş olduğu yolda taşınır. Hepsi `void`
 * döndüğü için cache cevaptan beslenemez — ajanda **ve** günlük özet birlikte
 * geçersizleştirilir (özet status sayımlarını tutuyor, geçiş onu da değiştirir).
 */
function useInvalidateClinicDays(clinicId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.days(clinicId),
      }),
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.summaries(clinicId),
      }),
    ]);
  };
}

export function useScheduleAppointment(clinicId: string) {
  const invalidate = useInvalidateClinicDays(clinicId);

  return useMutation({
    mutationFn: (data: ScheduleAppointment) =>
      api(appointmentEndpoints.schedule, { body: data }),
    onSuccess: invalidate,
  });
}

type StatusTransition = 'confirm' | 'complete' | 'noShow' | 'checkIn';

/**
 * Dört geçiş tek hook'ta: hepsinin imzası ve invalidation'ı aynı, ayrı ayrı
 * yazmak dört kopya üretirdi. Çağıran hangi geçişi istediğini mutate anında
 * söyler.
 */
export function useAppointmentTransition(clinicId: string) {
  const invalidate = useInvalidateClinicDays(clinicId);

  return useMutation({
    mutationFn: ({
      appointmentId,
      transition,
    }: {
      appointmentId: string;
      transition: StatusTransition;
    }) => api(appointmentEndpoints[transition], { params: { appointmentId } }),
    onSuccess: invalidate,
  });
}

export function useCancelAppointment(clinicId: string) {
  const invalidate = useInvalidateClinicDays(clinicId);

  return useMutation({
    // `appointmentId` hem yolda hem gövdede: controller yoldan alıp gövdeye
    // yazıyor (`{ ...dto, appointmentId: id }`), şema da onu zorunlu tutuyor.
    mutationFn: ({
      appointmentId,
      cancelReason,
    }: {
      appointmentId: string;
      cancelReason?: string;
    }) =>
      api(appointmentEndpoints.cancel, {
        params: { appointmentId },
        body: { appointmentId, cancelReason } satisfies CancelAppointment,
      }),
    onSuccess: invalidate,
  });
}
