import { Decimal } from 'decimal.js';
import type { CashSessionStatusType } from '@input-type-schemas/CashSessionStatusSchema';
import { Pagination } from '@shared/common';
import { CashSession as ICashSession } from '@model-schema/CashSessionSchema';
import { CashMovement as ICashMovement } from '@model-schema/CashMovementSchema';

// ==========================================
// Read-model filtreleri
// ==========================================

export interface FindCashSessionsFilter {
  clinicId: string;
  cashRegisterId?: string;
  status?: CashSessionStatusType;
  /** Yalnız sayım farkı sıfırdan farklı olan kapanışlar (fazla veya açık). */
  hasDifference?: boolean;
  pagination: Pagination;
}

// ==========================================
// Persistence read-model'leri
// ==========================================

/** Oturum + hareketleri (detay görünümü). */
export type CashSessionWithMovements = ICashSession & {
  movements: ICashMovement[];
};

/** Bir oturumdaki hareketlerin yön bazlı toplamı (kapanış hesabı için). */
export interface CashMovementTotals {
  totalIn: Decimal;
  totalOut: Decimal;
}

/**
 * Muhasebe köprüsünün ihtiyaç duyduğu tür-bazlı toplamlar (kapanışta özet fiş).
 * SALE_COLLECTION/REFUND kasıtlı hariç — Payment modülü zaten 100 Kasa'ya işliyor.
 */
export interface CashBridgeTotals {
  bankDepositTotal: Decimal; // BANK_DEPOSIT toplamı (B 102 / A 100)
  expenseTotal: Decimal; // EXPENSE toplamı (B 770 / A 100)
}
