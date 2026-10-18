import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { Decimal } from 'decimal.js';

/**
 * Tahsilatı alınmış ama faturası kesilmemiş ödeme (mutabakat read-model'i).
 *
 * Fatura kesimi olay güdümlüdür ve tetikleyici dinleyiciler hatayı yutup CRITICAL
 * alarm üretir (bkz. §12 P1-6) — yani fatura **hiç** oluşmamış olabilir. Hiç
 * yazılmamış bir faturayı mevcut mutabakatlar göremez (`sweep-unposted-financial-events`
 * yalnız YAZILMIŞ ekonomik olayları tarar). Bu read-model o boşluğu görünür kılar;
 * `BackfillMissingInvoicesCommand` ise aynı listeyi yeniden faturalar.
 */
export interface UninvoicedPaymentRow {
  paymentId: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  totalAmount: Decimal;
  currency: CurrencyType;
  firstCollectedAt: Date;
}

export interface FindUninvoicedPaymentsFilter {
  clinicId: string;
  from: Date;
  to: Date;
}
