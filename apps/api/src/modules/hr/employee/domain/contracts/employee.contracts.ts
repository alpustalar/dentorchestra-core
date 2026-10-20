import { ResponseGroups } from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// SERİLEŞTİRME GRUPLARI (RESPONSE GROUPS)
// ==========================================
// Personel cevaplarının alan görünürlüğü. Hassas alanlar (nationalId, maaş)
// FINANCIAL/MANAGEMENT tier'ında; grupları EmployeePolicy üretir.
// Modül-geneli (Employee + EmployeeContract + hr/attendance + hr/leave
// tüketicileri) — tek bir aggregate'e ait olmadığı için burada, düz dosyada durur.
export const EmployeeResponseGroups = ResponseGroups;

export type EmployeeResponseGroup =
  (typeof EmployeeResponseGroups)[keyof typeof EmployeeResponseGroups];
