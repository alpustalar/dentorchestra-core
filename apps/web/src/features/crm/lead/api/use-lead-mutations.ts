'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type CreateLead,
  leadEndpoints,
  type MarkLeadLost,
  type UpdateLeadStatus,
} from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { leadKeys } from './lead.keys';

/**
 * Hepsi aynı deseni izler: mutation → listeyi (ve varsa detayı)
 * geçersizleştir. Backend command'leri zengin model döndürmediği için
 * cache'i cevaptan güncelleyemeyiz; tek doğru yol yeniden çekmek.
 */
export function useCreateLead(clinicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLead) =>
      api(leadEndpoints.create, { params: { clinicId }, body: data }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: leadKeys.lists(clinicId) }),
  });
}

interface LeadMutationContext {
  clinicId: string;
  leadId: string;
}

export function useUpdateLeadStatus({ clinicId, leadId }: LeadMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateLeadStatus) =>
      api(leadEndpoints.updateStatus, { params: { leadId }, body: data }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.lists(clinicId) }),
        queryClient.invalidateQueries({ queryKey: leadKeys.detail(leadId) }),
      ]);
    },
  });
}

export function useMarkLeadLost({ clinicId, leadId }: LeadMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    // `clinicId` gövdenin parçası — şema öyle istiyor (`MarkLeadLostSchema`).
    mutationFn: (data: Omit<MarkLeadLost, 'clinicId'>) =>
      api(leadEndpoints.markLost, {
        params: { leadId },
        body: { ...data, clinicId },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.lists(clinicId) }),
        queryClient.invalidateQueries({ queryKey: leadKeys.detail(leadId) }),
      ]);
    },
  });
}

export function useConvertLead({ clinicId, leadId }: LeadMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { patientId?: string; appointmentId?: string }) =>
      api(leadEndpoints.convert, {
        params: { leadId },
        body: { ...data, clinicId },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.lists(clinicId) }),
        queryClient.invalidateQueries({ queryKey: leadKeys.detail(leadId) }),
      ]);
    },
  });
}
