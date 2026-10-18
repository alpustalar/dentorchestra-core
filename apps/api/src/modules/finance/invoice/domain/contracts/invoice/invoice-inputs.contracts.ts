import type { InvoiceStatusType } from '@input-type-schemas/InvoiceStatusSchema';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { Decimal } from 'decimal.js';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { EDocumentTypeType } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentStatusType } from '@input-type-schemas/EDocumentStatusSchema';

// ==========================================
// 2. INVOICE (FATURA) SÖZLEŞMELERİ
// ==========================================

export interface CreateInvoiceProps {
  id: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  paymentId: string | null;

  // Mali alanların tamamı Decimal: genel toplamın `number` olması aynı satırda iki
  // ayrı hassasiyet rejimi demekti (net/KDV Decimal, brüt float).
  amount: Decimal;
  currency: CurrencyType;
  vatRate: number;
  netTotal: Decimal;
  vatTotal: Decimal;

  status: InvoiceStatusType;

  invoiceNumber?: string;
  issuedAt?: Date;
  providerRef?: string;
  rawResponse?: unknown;
}

// ==========================================
// FATURA İŞLEM SÖZLEŞMELERİ
// ==========================================

// 1. FATURA İŞLEM HATASI SÖZLEŞMESİ
export interface FailInvoiceEntityProps {
  reason: string;
  source?: LogSource;
  actorId?: string;
}

// 2. E-BELGE SONUÇ SÖZLEŞMESİ
export interface ApplyEDocumentResultProps {
  documentType: EDocumentTypeType;
  uuid: string | null; // E-belge merkezi (GİB) tarafından üretilen evrensel ID
  status: EDocumentStatusType;
  invoiceNumber?: string | null;
  providerRef?: string | null; // Entegratör referansı (iz sürme)
  rawResponse?: unknown; // Entegratörden dönen ham yanıt
  source?: LogSource;
  actorId?: string;
}

// 3. FATURA İPTAL SÖZLEŞMESİ
export interface CancelInvoiceProps {
  /** Zorunlu: iptal gerekçesi denetim izinin kendisidir (kalıcı damga). */
  reason: string;
  /** Personel kimliği — Firebase UID (UUID değil). */
  cancelledById: string;
  source?: LogSource;
}
