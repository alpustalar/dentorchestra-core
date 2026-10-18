import type { LedgerSourceType } from '@input-type-schemas/LedgerSourceSchema';
import type { LedgerTypeType } from '@input-type-schemas/LedgerTypeSchema';
import type { LedgerCategoryType } from '@input-type-schemas/LedgerCategorySchema';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';
import { Money } from '@src/domain/value-objects/money.vo';

// ==========================================
// (DEFTER HAREKETİ) SÖZLEŞMELERİ
// ==========================================

export interface CreateFinanceLedgerProps {
  id?: string;
  organizationId: string;
  clinicId: string;
  patientId?: string | null;
  paymentId?: string | null;
  installmentId?: string | null;
  performedById?: string | null;

  type: LedgerTypeType; // Örn: DEBIT / CREDIT
  source: LedgerSourceType; // Örn: PATIENT_PAYMENT, INVOICE
  category: LedgerCategoryType; // Örn: TREATMENT, INVENTORY

  money: Money;

  /**
   * Kaynağın (taksit) o anki nihai durumu. Verilmezse COMPLETED.
   * Tahsilat/iade olayları sırasız teslim edilebildiği için kaydı yazan taraf
   * bu alanı doldurur (bkz. `FinanceLedgerEntity.create` yorumu).
   */
  status?: LedgerStatusType;

  taxRate?: number;
  description?: string;
  documentNo?: string;
  entryDate?: Date;
}
