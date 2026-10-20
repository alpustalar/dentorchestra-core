import { ResponseGroups } from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// SERİLEŞTİRME GRUPLARI (RESPONSE GROUPS)
// ==========================================
// Proje cevaplarının alan görünürlüğü; grupları ProjectPolicy üretir.
// Modül-geneli (Project + Phase + Task + Cost + ResourceAllocation
// tüketicileri) — tek bir aggregate'e ait olmadığı için burada, düz dosyada durur.
export const ProjectResponseGroups = ResponseGroups;

export type ProjectResponseGroup =
  (typeof ProjectResponseGroups)[keyof typeof ProjectResponseGroups];
