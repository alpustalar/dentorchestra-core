import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { ActivityStatusType as ActivityStatus } from '@input-type-schemas/ActivityStatusSchema';
import { Pagination } from '@shared/common';

// ==========================================
// LİSTELEME FİLTRELERİ (read-model)
// ==========================================

export interface FindActivitiesByLeadFilter {
  leadId: string;
  // Lead zaman çizelgesi klinik sınırına kapatılır — leadId tek başına
  // kiracılar arası okumaya açık kapı bırakıyordu.
  clinicId: string;
  pagination: Pagination;
}

export interface FindMyTasksFilter {
  assignedToId: string;
  clinicId?: string;
  status?: ActivityStatus;
  pagination: Pagination;
}

// ==========================================
// Aktivite cevaplarının alan görünürlüğü; grupları ClinicPolicy üretir.
// ==========================================

export const ActivityResponseGroups = ResponseGroups;

export type ActivityResponseGroup =
  (typeof ActivityResponseGroups)[keyof typeof ActivityResponseGroups];
