import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { InvoiceStatusType } from '@input-type-schemas/InvoiceStatusSchema';
import { Decimal } from 'decimal.js';

// ==========================================
// FATURA LİSTELEME (READ-MODEL) SÖZLEŞMELERİ
// ==========================================

/** Fatura listeleme filtresi — org zorunlu (tenant sınırı), klinik opsiyonel daraltma. */
export interface FindInvoicesFilter {
  organizationId: string;
  clinicId?: string;
}

/** Fatura listeleme okuma modeli (entity DEĞİL; HTTP sınırında serileştirilebilir düz veri). */
export interface InvoiceListItem {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  grandTotal: string;
  currency: CurrencyType;
  status: InvoiceStatusType;
  invoiceNumber: string | null;
  issuedAt: Date | null;
  createdAt: Date;
}

/** Fatura detay okuma modeli (tek kayıt) — get-by-id ve get-by-payment ortak kullanır. */
export interface InvoiceView {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  netTotal: string;
  vatTotal: string;
  grandTotal: string;
  vatRate: Decimal;
  currency: CurrencyType;
  issuedAt: Date | null;
  status: InvoiceStatusType;
  /**
   * İptal izi. `status = CANCELLED` "bu belge hükümsüz" der ama operatörün
   * sorduğu soru "ne zaman ve neden" — iz yalnız audit log'da kalırsa ekranda
   * görünmez. İptal edilmemiş faturada üçü de null.
   */
  cancelledAt: Date | null;
  cancelReason: string | null;
}
