import { Decimal } from 'decimal.js';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { InstallmentStatusType } from '@input-type-schemas/InstallmentStatusSchema';

/**
 * Payment domain kontratları — okuma modelleri (yaşlandırma/rapor read-model'leri
 * + dış sağlayıcı taksit seçenekleri).
 */

// ==========================================
// YAŞLANDIRMA & RAPORLAMA (AGING & REVENUE)
// ==========================================

export interface ArAgingFilter {
  clinicId: string;
}

/**
 * Henüz tahsil edilmemiş (açık) taksit — repository projeksiyon satırı.
 *
 * `currency` **zorunlu**: sağlık turizmi klinikleri aynı kasada TRY ve EUR
 * tahsil ediyor; para birimi satırda taşınmadığı için raporlar 1.000 EUR ile
 * 1.000 TRY'yi toplayıp 2.000 yazıyordu.
 */
export interface OpenInstallmentRow {
  patientId: string;
  amount: Decimal;
  currency: CurrencyType;
  dueDate: Date | null;
}

/** Para birimi başına tahsil edilmiş toplam. */
export interface CollectedTotalRow {
  currency: CurrencyType;
  amount: Decimal;
}

export interface ArAgingData {
  openInstallments: OpenInstallmentRow[];
  collectedTotals: CollectedTotalRow[];
}

/** Tahsil edilmiş taksit — hekim boyutu (yönetim raporu). */
export interface CollectedInstallmentRow {
  /** Atanmamış hekimler için null desteği. */
  providerId: string | null;
  amount: Decimal;
  currency: CurrencyType;
}

export interface ProviderRevenueFilterData {
  clinicId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ==========================================
// TAKSİT SEÇENEKLERİ — iyzico API'sinden gelen read-model
// ==========================================

export interface InstallmentOption {
  installmentNumber: number;
  totalPrice: number;
  installmentPrice: number;
  installmentRate: number;
}

/**
 * Tahsilatı başlamış ödeme satırı (fatura eksiği taraması için).
 *
 * Fatura tahakkuku tahsilata bağlı olduğu için (doc 03) "en az bir taksiti
 * tahsil edilmiş ama faturası kesilmemiş" ödemeler operasyonel bir eksiktir:
 * para alınmış, yasal belge yok. Faturanın var olup olmadığını bu modül
 * BİLMEZ (bounded context) — yalnız adayları döner, eşleştirme invoice
 * modülünde yapılır.
 */
export interface CollectedPaymentRow {
  paymentId: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  totalAmount: Decimal;
  currency: CurrencyType;
  firstCollectedAt: Date;
}

export interface FindCollectedPaymentsFilter {
  clinicId: string;
  /** Tahsilat tarihi aralığı (ilk tahsil edilen taksitin `paidAt`'i). */
  from: Date;
  to: Date;
}

// ==========================================
// CARİ DEFTER KÖPRÜSÜ — taksit okuma modelleri
// ==========================================

/**
 * Tek taksitin cari defteri besleyen hâli (durum **ne olursa olsun**).
 *
 * Cari kaydı yazan taraf, tahsilat ve iade olaylarının sırasız teslim
 * edilebildiği için kaydı yazdığı anda taksitin NİHAİ durumunu okumak
 * zorundadır; bu yüzden satır PENDING/CANCELLED taksitler için de döner ve
 * kararı (yaz / yazma / iade olarak yaz) çağıran verir.
 */
export interface InstallmentLedgerRow {
  installmentId: string;
  paymentId: string;
  clinicId: string;
  patientId: string;
  amount: Decimal;
  currency: CurrencyType;
  status: InstallmentStatusType;
  paidAt: Date | null;
}

/**
 * Tahsil edilmiş ya da iade edilmiş taksit (cari defter mutabakatı).
 *
 * İade edilen taksit de "sonuçlanmış"tır: cari defterde karşılığının REFUNDED
 * olması gerekir. Tarih aralığı `paidAt` üzerinden süzülür — iade taksitin
 * tahsil tarihini değiştirmez.
 */
export interface SettledInstallmentRow {
  installmentId: string;
  paymentId: string;
  clinicId: string;
  patientId: string;
  amount: Decimal;
  currency: CurrencyType;
  status: InstallmentStatusType;
  settledAt: Date;
}

export interface FindSettledInstallmentsFilter {
  clinicId: string;
  /** Tahsilat tarihi aralığı (`paidAt`). */
  from: Date;
  to: Date;
}
