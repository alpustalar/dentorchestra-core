import { ResponseGroups } from '../../../../../../../packages/shared/common/constants/response-groups.constant';

// ==========================================
// FİNANS SERİLEŞTİRME GRUPLARI (RESPONSE GROUPS)
// ==========================================
// Tüm finans modülleri (ledger, invoice, payment, payroll, pos, purchase-invoice)
// aynı gruplama vokabülerini paylaşır. Response DTO'ları @Expose({ groups }) ile
// alanları bu gruplara göre gizler; grupları FinancePolicy üretir.
export const FinanceResponseGroups = ResponseGroups;

export type FinanceResponseGroup =
  (typeof FinanceResponseGroups)[keyof typeof FinanceResponseGroups];
