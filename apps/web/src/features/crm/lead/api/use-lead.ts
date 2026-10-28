'use client';

import { useQuery } from '@tanstack/react-query';
import { leadEndpoints } from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { leadKeys } from './lead.keys';

export function useLead(leadId: string | undefined) {
  return useQuery({
    queryKey: leadKeys.detail(leadId ?? ''),
    queryFn: ({ signal }) =>
      api(leadEndpoints.byId, { params: { leadId: leadId! }, signal }),
    enabled: Boolean(leadId),
  });
}
