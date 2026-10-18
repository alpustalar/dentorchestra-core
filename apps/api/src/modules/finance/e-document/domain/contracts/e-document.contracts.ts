// domain/contracts/e-document.contracts.ts
import type { EDocumentTypeType } from '@input-type-schemas/EDocumentTypeSchema';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { EDocumentStatusType } from '@input-type-schemas/EDocumentStatusSchema';

// ==========================================
// 1. YARDIMCI VE ALT SÖZLEŞMELER (SUB-CONTRACTS)
// ==========================================

export interface PartyTaxInfo {
  taxId: string | null; // VKN veya TCKN
  name: string;
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
