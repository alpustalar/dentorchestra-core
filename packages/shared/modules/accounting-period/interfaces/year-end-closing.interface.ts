import type { PurchaseInvoiceLineAccountCode } from '@shared/common/constants';

/**
 * Yıl sonu kapanış önizlemesinin okuma modeli — backend sorgusu ve frontend aynı tipi kullanır.
 * Tutarlar **kuruş ölçeğinde ondalık string**; tarihler `Date`.
 */

export type YearEndClosingStepType =
  | 'GRNI_ACCRUAL' // mal geldi fatura gelmedi tahakkuku (31.12)
  | 'COST_REFLECTION' // 7/A → 6: B 622|631|632 / A 741|761|771
  | 'COST_REFLECTION_CLOSE' // yansıtma hesaplarının kapatılması: B 741|761|771 / A 740.xx|760|770
  | 'CLOSE_TO_RESULT' // 6. sınıf → 690
  | 'RESULT_TRANSFER' // 690 → 590 (kâr) | 591 (zarar)
  | 'EQUITY_CARRYFORWARD' // 590/591 → 570/580 (şirket) | 500 (şahıs) — ertesi yılın 1 Ocak'ı; işletme biçimi seçiliyse
  | 'GRNI_REVERSAL'; // tahakkukun ertesi yılın 1 Ocak'taki ters kaydı

export type YearEndClosingEntryKind = 'ADJUSTING' | 'CLOSING';

/** Fişin düştüğü dönem: kapanan yıl mı, ertesi yıl mı (GRNI ters kaydı ve öz kaynak devri ertesi yıla düşer). */
export type YearEndClosingEntryPeriod = 'CLOSING_PERIOD' | 'NEXT_PERIOD';

export interface YearEndClosingLine {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  lineDesc: string;
}

export interface YearEndClosingStep {
  step: YearEndClosingStepType;
  entryKind: YearEndClosingEntryKind;
  period: YearEndClosingEntryPeriod;
  entryDate: Date;
  description: string;
  lines: YearEndClosingLine[];
  totalDebit: string;
}

export interface YearEndClosingSummary {
  /** Sonuç hesaplarının alacak bakiyeleri toplamı (yansıtma sonrası). */
  incomeTotal: string;
  /** Sonuç hesaplarının borç bakiyeleri toplamı (yansıtma sonrası). */
  expenseTotal: string;
  /** Pozitif: kâr (590), negatif: zarar (591), sıfır: devir yok. */
  netResult: string;
  resultAccountCode: '590' | '591' | null;
  /** 7/A'dan 6. sınıfa yansıtılan maliyetler toplamı. */
  reflectedCostTotal: string;
  /** GRNI tahakkuku (329) toplamı. */
  grniAccrualTotal: string;
}

export type GrniNotAccruableReason = 'FOREIGN_CURRENCY';

/**
 * 31 Aralık itibarıyla "malı geldi, faturası gelmedi" siparişi. Tutarlar **KDV hariç**:
 * KDV fatura kesildiğinde doğar (191), tahakkuka girmez.
 */
export interface GrniAccrualCandidate {
  orderId: string;
  supplierId: string;
  orderDate: Date;
  currency: string;
  /** Teslim alınan malın KDV hariç değeri (günlükten, `asOf`'a kadar). */
  receivedNet: string;
  /** Siparişe bağlı alış faturalarının matrah toplamı (`asOf`'a kadar). */
  invoicedNet: string;
  /** Tahakkuk tutarı = teslim − fatura (pozitif). */
  accrualAmount: string;
  accruable: boolean;
  notAccruableReason: GrniNotAccruableReason | null;
  /** Tüm kalemler katalog ürünüyse `150`; serbest kalem varsa muhasebeci seçer (null). */
  suggestedDebitAccountCode: PurchaseInvoiceLineAccountCode | null;
  /**
   * Teslim değerinin bir kısmı günlük kurulmadan önceki kabullerden TÜRETİLDİ (tarihleri
   * yaklaşık). Tahakkuk bu yüzden kesin değil; muhasebeci kabul tarihlerini doğrulamalıdır.
   */
  includesLegacyReceipts: boolean;
}

/** Faturalanmış ama (henüz) teslim alınmamış stok — bilgi amaçlı, otomatik fiş yok. */
export interface InvoicedNotReceivedWarning {
  orderId: string;
  supplierId: string;
  currency: string;
  invoicedNet: string;
  receivedNet: string;
  /** fatura − teslim (pozitif). */
  difference: string;
}

export type YearEndClosingBlockerCode =
  | 'PERIOD_ALREADY_CLOSED'
  | 'PREVIOUS_PERIOD_NOT_CLOSED'
  | 'UNPOSTED_EVENTS'
  | 'NEXT_PERIOD_UNAVAILABLE'
  | 'ACCOUNTS_MISSING'
  | 'UNMAPPED_COST_ACCOUNT'
  | 'GRNI_SELECTION_INVALID';

/** Kapanışı durduran koşul. Önizleme bunları fırlatmaz, listeler; kapanış komutu aynı koşulları fırlatır. */
export interface YearEndClosingBlocker {
  code: YearEndClosingBlockerCode;
  message: string;
  meta: Record<string, unknown>;
}

export interface YearEndClosingWarnings {
  /** Dönem sonu henüz gelmedi: dönemi kapatmak yılın kalanındaki hareketleri reddettirir. */
  periodNotEnded: boolean;
  /**
   * İşletme biçimi (şirket / şahıs) seçilmemiş: öz kaynak devri (590/591 → 570/580 | 500) atlanır ve
   * sonuç 590/591'de kalır. Eski kliniklerde görülür; kayıt akışı biçimi zorunlu alır.
   */
  businessTypeMissing: boolean;
  /**
   * K4: faturası kabulünden fazla olan stok (150/153) siparişleri. Otomatik fiş atılmaz;
   * gerekirse muhasebeci 159 fişini `ADJUSTING` olarak elle girer.
   */
  invoicedNotReceived: InvoicedNotReceivedWarning[];
  /** Tahakkuk adayı olup SEÇİLMEMİŞ siparişler (bilerek bırakılmış olabilir). */
  unselectedGrniOrderIds: string[];
}

export interface YearEndClosingPreview {
  periodId: string;
  clinicId: string;
  year: number;
  periodStatus: 'OPEN' | 'LOCKED' | 'CLOSED';
  startsAt: Date;
  endsAt: Date;
  /**
   * Önizleme anındaki yevmiye sayacı. `POST close` bu değeri geri göndermek zorundadır;
   * araya fiş girdiyse kapanış reddedilir.
   */
  expectedLastEntryNo: string;
  summary: YearEndClosingSummary;
  steps: YearEndClosingStep[];
  grniCandidates: GrniAccrualCandidate[];
  blockers: YearEndClosingBlocker[];
  warnings: YearEndClosingWarnings;
  /** Kapanış blokajsız mı (`blockers` boş). */
  canClose: boolean;
}
