// domain/contracts/e-document.contracts.ts
import type { EDocumentTypeType } from '@input-type-schemas/EDocumentTypeSchema';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { EDocumentStatusType } from '@input-type-schemas/EDocumentStatusSchema';
import type {
  EDocumentEnvironmentSchema,
  EDocumentProviderSchema,
} from '@shared/modules/e-document/schemas';
import { z } from 'zod';

export type EDocumentProvider = z.infer<typeof EDocumentProviderSchema>;
export type EDocumentEnvironment = z.infer<typeof EDocumentEnvironmentSchema>;
export type EDocumentIntegrationScope = 'CLINIC' | 'ORGANIZATION';

export interface CreateEDocumentIntegrationConfigProps {
  id?: string;
  scope: EDocumentIntegrationScope;
  provider: EDocumentProvider;
  environment: EDocumentEnvironment;
  credentialsCiphertext: string;
  credentialHint: string | null;
  clinicId: string | null;
  organizationId: string | null;
}

export interface EDocumentIntegrationConfigData {
  id: string;
  scope: EDocumentIntegrationScope;
  provider: EDocumentProvider;
  environment: EDocumentEnvironment;
  credentialsCiphertext: string;
  credentialHint: string | null;
  isActive: boolean;
  lastTestedAt: Date | null;
  lastTestSucceeded: boolean | null;
  clinicId: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EDocumentIntegrationView {
  id: string;
  scope: EDocumentIntegrationScope;
  provider: EDocumentProvider;
  environment: EDocumentEnvironment;
  configured: true;
  credentialHint: string | null;
  inherited: boolean;
  sourceId: string;
  lastTestedAt: Date | null;
  lastTestSucceeded: boolean | null;
  updatedAt: Date;
}

export const NilveraCredentialsSchema = z.object({
  provider: z.literal('NILVERA'),
  apiKey: z.string().min(16),
});
export type NilveraCredentials = z.infer<typeof NilveraCredentialsSchema>;

export const EDocumentCredentialsSchema = z.discriminatedUnion('provider', [
  NilveraCredentialsSchema,
]);
export type EDocumentCredentials = z.infer<typeof EDocumentCredentialsSchema>;

export interface ResolvedEDocumentIntegration {
  configId: string;
  scope: EDocumentIntegrationScope;
  sourceId: string;
  provider: EDocumentProvider;
  environment: EDocumentEnvironment;
  credentials: EDocumentCredentials;
}

// ==========================================
// 1. YARDIMCI VE ALT SÖZLEŞMELER (SUB-CONTRACTS)
// ==========================================

export interface PartyTaxInfo {
  taxId: string | null; // VKN veya TCKN
  name: string;
  taxOffice?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  isEInvoiceUser?: boolean;
  alias?: string | null; // e-Fatura posta kutusu etiketi
}

export interface EDocumentLine {
  name: string;
  quantity: number;
  unitPrice: string; // Mali hassasiyet için string tutulmuştur
  vatRate: number;
  vatAmount: string;
  withholdingAmount?: string;
}

export interface EDocumentTotals {
  net: string;
  vat: string;
  withholding?: string;
  payable: string;
}

// ==========================================
// 2. ANA PROPS VE RESPONSE SÖZLEŞMELERİ
// ==========================================

/** Çekirdeğin porta geçtiği belge isteği (doc 07 §3). Adapter'a özgü değildir. */
export interface EDocumentRequest {
  clinicId: string;
  type: EDocumentTypeType;
  invoiceId: string; // İç sistem faturası
  /**
   * Sağlayıcı tarafında tekilleştirme anahtarı (= `invoiceId`). Çekirdek tarafındaki
   * asıl kapı gönderim hakkının sahiplenilmesidir (`claimForEDocumentDispatch`);
   * bu alan gerçek entegratör adapter'larının kendi idempotency başlığını
   * doldurabilmesi için sözleşmede durur.
   */
  idempotencyKey: string;
  issueDate: Date;
  seller: PartyTaxInfo;
  buyer: PartyTaxInfo;
  lines: EDocumentLine[];
  totals: EDocumentTotals;
  currency: CurrencyType;
  note?: string;
}

/** Portun döndürdüğü belge sonucu. Noop'ta documentType=INTERNAL, uuid=null. */
export interface EDocumentResult {
  documentType: EDocumentTypeType;
  uuid: string | null; // ETTN genellikle UUID formatındadır, INTERNAL ise null
  status: EDocumentStatusType;
  invoiceNumber: string | null; // Entegratörün atadığı Belge No (Örn: GIB20260000001)
  rawResponse?: unknown; // Entegratörden dönen ham veri
}

export interface MailboxInfo {
  isEInvoiceUser: boolean;
  alias?: string; // e-Fatura posta kutusu etiketi (Örn: urn:mail:defaultpk@firma.com)
}
