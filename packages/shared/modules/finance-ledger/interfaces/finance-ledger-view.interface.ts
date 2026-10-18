/**
 * `apps/api` → `FinanceLedgerQueryController` cevap sözleşmeleri.
 *
 * **Opsiyonel alanlar yetki demektir, eksik veri değil.** Backend cevabı
 * `@Serialize` ile serileştirme gruplarından geçiriyor: tutar/ciro alanları
 * yalnız finans tier'ına (`FINANCIAL`/`MANAGEMENT`/`ADMIN`) açık, resepsiyonun
 * gördüğü cevaptan **tamamen silinerek** gelir. Bu yüzden burada `string | null`
 * değil `?: string` yazılıdır — `null` "boş", `undefined` "görme yetkin yok".
 * Arayüz ikisini aynı şeye çevirmemeli.
 */

/** Klinik cari defteri satırı (`FinanceLedgerResponseDto`). */
export interface ClinicLedgerEntry {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string | null;

  // --- Operasyon tier'ı ---
  type?: string;
  source?: string;
  category?: string;
  status?: string;
  description?: string | null;
  documentNo?: string | null;
  entryDate?: string;

  // --- Finans tier'ı ---
  amount?: number;
  currency?: string;
  taxRate?: number;
  taxAmount?: number;
  paymentId?: string | null;
  installmentId?: string | null;
  performedById?: string | null;

  // --- Yönetim tier'ı ---
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Para birimi başına klinik finans toplamı. Tutarlar `string`: sunucu `Decimal`
 * tutuyor ve JSON'a string olarak yazıyor — `number`a çevirmek kuruş
 * hassasiyetini kaybettirir, bu yüzden istemci de string taşır.
 */
export interface LedgerCurrencyTotalView {
  currency?: string;
  totalIncome?: string;
  totalExpenses?: string;
  balance?: string;
  entryCount?: number;
}

/**
 * Klinik finans özeti (`LedgerSummaryResponseDto`).
 *
 * Toplam **daima** para birimi kırılımında gelir: tek bir `balance` alanı
 * 1.000 EUR ile 1.000 TRY'yi toplayıp 2.000 gösteriyordu. Arayüz kırılımı
 * birleştirmek isterse kuru kendisi uygulamak zorundadır.
 */
export interface LedgerSummaryView {
  totals?: LedgerCurrencyTotalView[];
  /** Tüm para birimlerindeki satır sayısı (tutar değil; toplanabilir). */
  entryCount?: number;
}

/** Hastanın para birimi başına bakiyesi (negatif = hasta borçlu). */
export interface PatientCurrencyBalanceView {
  currency?: string;
  totalServiceAmount?: string;
  totalPayments?: string;
  balance?: string;
}

/** Hasta cari özeti (`PatientFinanceSummaryResponseDto`). */
export interface PatientFinanceSummaryView {
  /** Kalan bakiye — tahsilat yapan resepsiyona da açık. */
  balances?: PatientCurrencyBalanceView[];
}

/** Hasta cari hareketi (`PatientLedgerItemResponseDto`). */
export interface PatientLedgerEntry {
  id?: string;
  category?: string;
  entryDate?: string;
  status?: string;
  description?: string | null;
  paymentMethod?: string | null;
  providerName?: string | null;
  amount?: string;
  /** Tutarın para birimi — satırda taşınmadığı için TRY sanılıyordu. */
  currency?: string;
}

/**
 * Cari defter mutabakat satırı (`LedgerMismatchResponseDto`).
 *
 * `MISSING` — tahsilat/iade var, cari kaydı hiç yazılmamış.
 * `STATUS_DRIFT` — kayıt var ama durumu taksitin nihai durumundan farklı.
 */
export interface LedgerMismatchView {
  installmentId?: string;
  paymentId?: string;
  clinicId?: string;
  patientId?: string;
  kind?: 'MISSING' | 'STATUS_DRIFT';
  expectedStatus?: string;
  ledgerStatus?: string | null;
  settledAt?: string;
  amount?: string;
  currency?: string;
}

/** Telafi (backfill) turunun sonucu. */
export interface BackfillLedgerEntriesResultView {
  attempted: number;
  recorded: number;
  synced: number;
  failed: Array<{ installmentId: string; reason: string }>;
}
