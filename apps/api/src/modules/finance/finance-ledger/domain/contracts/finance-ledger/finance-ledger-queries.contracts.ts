import { Decimal } from 'decimal.js';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';

// ==========================================
// Defter özet / read-model sözleşmeleri
// ==========================================

/**
 * Para birimi başına cari özet.
 *
 * Toplamlar **daima** para birimi kırılımında döner: sağlık turizmi klinikleri
 * aynı deftere TRY ve EUR yazıyor; tek bir toplam 1.000 EUR ile 1.000 TRY'yi
 * toplayıp 2.000 gösteriyordu.
 */
export interface LedgerCurrencyTotal {
  currency: CurrencyType;
  totalIncome: string;
  totalExpenses: string;
  balance: string;
  entryCount: number;
}

/** Finansal özet döndürürken veri tipini korumak için tip sözleşmesi. */
export interface LedgerSummary {
  totals: LedgerCurrencyTotal[];
  /** Tüm para birimlerindeki satır sayısı (tutar değil; toplanabilir). */
  entryCount: number;
}

export interface GetSummaryFilter {
  dateFrom?: Date;
  dateTo?: Date;
}

/** Hastanın para birimi başına bakiyesi (negatif = hasta borçlu). */
export interface PatientCurrencyBalance {
  currency: CurrencyType;
  totalServiceAmount: string;
  totalPayments: string;
  balance: string;
}

export interface PatientFinanceSummary {
  balances: PatientCurrencyBalance[];
}

export interface PatientLedgerItem {
  id: string;
  amount: string;
  currency: CurrencyType;
  category: string; // veya LedgerCategoryType
  entryDate: Date;
  status: string; // veya LedgerStatusType
  description: string | null;
  paymentMethod: string | null; // veya PaymentMethodType
  providerName: string | null;
}

/** Reklam kampanyasına atfedilmiş hasta geliri (ROI / Attribution için). */
export interface PatientRevenue {
  patientId: string;
  currency: CurrencyType;
  revenue: string;
}

export interface SumIncomeByPatientsFilter {
  patientIds: string[];
  from: Date;
  to: Date;
}

// ==========================================
// Mutabakat (kaynak ↔ cari defter)
// ==========================================

/**
 * `MISSING` — taksit tahsil/iade edilmiş ama cari kaydı hiç yazılmamış.
 * `STATUS_DRIFT` — kayıt var ama durumu taksitin nihai durumundan farklı
 * (ör. iade yapıldı, cari hâlâ tahsilat görünüyor).
 */
export type LedgerMismatchKind = 'MISSING' | 'STATUS_DRIFT';

export interface LedgerMismatchRow {
  installmentId: string;
  paymentId: string;
  clinicId: string;
  patientId: string;
  amount: Decimal;
  currency: CurrencyType;
  /** Taksitin nihai durumundan türeyen, defterde olması gereken durum. */
  expectedStatus: LedgerStatusType;
  /** Defterdeki mevcut durum — kayıt hiç yoksa `null`. */
  ledgerStatus: LedgerStatusType | null;
  kind: LedgerMismatchKind;
  settledAt: Date;
}

export interface FindLedgerMismatchesFilter {
  clinicId: string;
  from: Date;
  to: Date;
}

/** Taksit → cari kaydın durumu (mutabakat eşleştirmesi). */
export interface LedgerEntryStatusRow {
  installmentId: string;
  status: LedgerStatusType;
}
