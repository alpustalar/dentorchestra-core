/**
 * FinancialEvent.payload'ın posting kurallarınca beklenen tipli biçimleri.
 * Tutarlar string (Decimal hassasiyeti korunur).
 */

import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { ChargebackFundsChannelType } from '@input-type-schemas/ChargebackFundsChannelSchema';
import type {
  InboundPaymentMethod,
  OutboundPaymentMethod,
  PurchaseInvoiceLineAccountCode,
} from '@shared/common/constants';

export interface PaymentReceivedEventPayload {
  /**
   * `| string` kaldırıldı: birleşim açık kaldığı sürece tip hiçbir şeyi
   * kısıtlamıyordu ve posting kuralı tanımadığı her değeri sessizce 102
   * Bankalar'a yazıyordu. Kabul kümesi tek kaynaktan gelir
   * (`INBOUND_PAYMENT_METHODS`) ve gövde doğrulaması da onu kullanır.
   */
  method: InboundPaymentMethod;
  amount: string;
  partyId: string;
  /**
   * İşlemin para birimi. Verilmezse defterin fonksiyonel para birimi varsayılır.
   * Yabancı para (ör. sağlık turizmi EUR tahsilatı) ise posting fonksiyonel paraya çevirir.
   */
  currency?: CurrencyType;
}

/**
 * Müşteriye geri verilen para — tahsilat fişinin **aynası**.
 *
 * Ayrı bir olay tipi, tahsilat fişinin storno'su değil: para o gün gerçekten
 * alınmıştı ve iadenin kendi tarihi var (orijinal dönem kapanmış olabilir).
 * Yöntem kümesi `INBOUND`'dur çünkü iade **geldiği enstrümandan** geri gider.
 */
export interface PaymentRefundedEventPayload {
  method: InboundPaymentMethod;
  amount: string;
  partyId: string;
  /** Verilmezse defterin fonksiyonel para birimi varsayılır (bkz. Model A). */
  currency?: CurrencyType;
  /** Orijinal tahsilat izi (POS işlem id'si / taksit id'si) — fiş açıklamasına geçer. */
  reference?: string;
}

/**
 * Satıcıya yapılan ödeme — 320'deki borcu kapatır.
 *
 * `PaymentReceivedEventPayload`'ın karşı yönü: orada müşteriden tahsil edilip
 * 120 kapanır, burada satıcıya ödenip 320 kapanır.
 */
export interface PaymentMadeEventPayload {
  /** Çıkışta kart yoktur (bkz. `OUTBOUND_PAYMENT_METHODS` notu). */
  method: OutboundPaymentMethod;
  amount: string;
  partyId: string;
  /** Verilmezse defterin fonksiyonel para birimi varsayılır (bkz. Model A). */
  currency?: CurrencyType;
  /** Havale/dekont referansı — fiş açıklamasına geçer. */
  reference?: string;
}

export interface SalesInvoiceIssuedEventPayload {
  partyId: string;
  netTotal: string;
  vatTotal: string;
  grandTotal: string;
  revenueAccountCode?: string; // ör. '600.04' (İmplant); verilmezse '600.01'
  withholdingTotal?: string; // SMM/serbest meslek stopajı (193); ödeyen vergi sorumlusuysa > 0
  currency?: CurrencyType; // yabancı fatura (ör. sağlık turizmi EUR) → posting'de fonksiyonel paraya çevrilir
}

export interface PurchaseInvoiceReceivedEventPayload {
  partyId: string; // tedarikçi carisi (320)
  netTotal: string;
  vatTotal: string;
  grandTotal: string;
  /** Kabul kümesi tek kaynaktan: `PURCHASE_INVOICE_LINE_ACCOUNT_CODES` (329 hariç). */
  lineAccountCode: PurchaseInvoiceLineAccountCode;
  currency?: CurrencyType; // yurtdışı tedarikçi / ithal (EUR/USD) → posting'de fonksiyonel paraya çevrilir
}

export interface PayrollAccruedEventPayload {
  partyId: string; // personel carisi (335)
  grossSalary: string; // brüt ücret
  employerSgk: string; // işveren SGK payı
  netPayable: string; // personele net ödenecek
  taxWithholding: string; // GV stopajı + damga (360)
  employeeSgk: string; // işçi SGK kesintisi (361 = employeeSgk + employerSgk)
}

export interface CashSessionClosedEventPayload {
  bankDepositTotal: string; // oturumdaki BANK_DEPOSIT toplamı (B 102 / A 100)
  expenseTotal: string; // oturumdaki EXPENSE toplamı (B 770 / A 100)
  difference: string; // sayım − beklenen (imzalı): + fazla (B 100 / A 679), − açık (B 689 / A 100)
  currency?: CurrencyType; // yabancı kasa → posting fonksiyonel paraya çevirir (Model A)
}

/**
 * Sağlayıcı hesap kapaması (settlement/payout).
 *
 * Kartla tahsil edilen para sağlayıcıda bekler; valör günü komisyon kesilerek
 * bankaya geçer. Defterdeki bekleyen tutar 108'de durur ve bu olay onu kapatır:
 * `brüt = net + komisyon` eşitliği fişin dengesidir (gövde şemasında zorunlu).
 */
export interface ProviderSettlementReceivedEventPayload {
  grossAmount: string; // 108'den düşen (bekleyen tahsilatlar)
  netAmount: string; // 102'ye giren (bankaya geçen)
  commissionAmount: string; // 653'e yazılan (sağlayıcı kesintisi)
  currency?: CurrencyType;
  provider: string; // IYZICO / PAX_BANK / ... (açıklama ve mutabakat izi)
  reference: string; // sağlayıcının payout referansı
}

/**
 * Kart itirazı AÇILDI — sağlayıcı parayı kesti, sonuç henüz belli değil.
 *
 * Para "kaybedilmiş" sayılmaz: 127 ara hesabında bekler (`B 127 / A 108|102`).
 * `fundsChannel` paranın **nereden** kesildiğini söyler (sağlayıcıdaki bekleyen
 * bakiye mi, doğrudan banka mı); ücret aynı kanaldan kesilir.
 */
export interface CardChargebackOpenedEventPayload {
  amount: string; // itiraz edilen (kesilen) tutar → 127 borç
  feeAmount: string; // sağlayıcının itiraz ücreti → 653 borç; 0 olabilir
  fundsChannel: ChargebackFundsChannelType; // 108 | 102 alacak
  currency: CurrencyType;
  provider: string; // IYZICO / PAX_BANK / ... (açıklama ve mutabakat izi)
  caseReference: string; // sağlayıcının vaka numarası
}

/** Kart itirazı KAZANILDI — kesilen para geri geldi (`B 108|102 / A 127`). */
export interface CardChargebackWonEventPayload {
  amount: string; // 127'den düşen tutar
  fundsChannel: ChargebackFundsChannelType; // paranın döndüğü yer (açılıştakinden farklı olabilir)
  currency: CurrencyType;
  provider: string;
  caseReference: string;
}

/**
 * Kart itirazı KAYBEDİLDİ — kesinleşti (`B 120 / A 127`). Hasta borcu yeniden
 * doğar: tahsilat fiilen geri alınmıştır, ama borç silinmemiştir.
 */
interface CardChargebackLostBase {
  amount: string; // 127'den düşen tutar
  currency: CurrencyType;
  provider: string;
  caseReference: string;
}

/** Hasta tahsilatı itirazı: kayıp hasta borcunu geri getirir (`B 120`, cari zorunlu). */
export interface CardChargebackLostPatientPayload extends CardChargebackLostBase {
  partyId: string; // 120 satırının carisi (requiresParty)
}

/**
 * Platform rezervasyon tahsilatı itirazı: platformun alacaklısı olacak bir hasta carisi yoktur,
 * kayıp 659.01'e gider. `platformLoss: true` bilinçli açık bir işarettir — `partyId` yokluğundan
 * türetmek, cari unutulmuş bir hasta itirazını sessizce platform zararına çevirirdi.
 */
export interface CardChargebackLostPlatformPayload extends CardChargebackLostBase {
  platformLoss: true;
}

export type CardChargebackLostEventPayload =
  | CardChargebackLostPatientPayload
  | CardChargebackLostPlatformPayload;

/**
 * Sağlık turizmi rezervasyon tahsilatı — **platform** defterine yazılır.
 *
 * Platform aracıdır (acente): müşteriden `saleAmount` tahsil edilir, bunun
 * `supplierAmount` kadarı tedarikçiye (HotelBeds) borçtur, kalan `commission`
 * platformun geliridir. Bu yüzden gelir olarak **yalnız komisyon** yazılır;
 * tedarikçi payı hasılat değil borçtur (aracı/net yaklaşımı).
 *
 * `saleAmount = commission + supplierAmount` — kural bu eşitliği doğrular.
 */
export interface PlatformBookingSettledEventPayload {
  saleAmount: string; // müşteriden tahsil edilen brüt
  supplierAmount: string; // tedarikçiye (HotelBeds) borç — net maliyet
  commission: string; // platform geliri = saleAmount − supplierAmount
  /**
   * 320 satırının carisi. **Zorunlu**: 320 `requiresParty` taşıdığı için
   * carisiz satır fişe dönüşmez (`PartyRequiredForAccountException`) — yani
   * gövdede bu alan yoksa tahsilat defteri hiç yazılmaz.
   */
  supplierPartyId: string;
  /**
   * **Paranın fiilen hareket ettiği** para birimi — satış para birimi değil.
   *
   * Satış EUR olsa bile iyzico hastadan TRY çeker (link üretilirken kilitlenen
   * kurla). Gövdeyi satış cinsinden yazmak posting'in kuru olay tarihine göre
   * TCMB'den **yeniden türetmesine** yol açıyordu: 108 hesabına fiilen gelmemiş
   * bir tutar yazılıyor, fark sessizce komisyona biniyordu.
   */
  currency: CurrencyType;
  bookingType: string; // HOTEL | TRANSFER — fiş açıklaması için
  provider: string; // IYZICO | STRIPE — tahsilatın geldiği kanal
  /** Çevrim yapıldıysa orijinal (satış) para birimi. */
  originalCurrency?: CurrencyType;
  /** Orijinal → gövde para birimi kuru (kilitli, `Decimal(12,6)` string). */
  fxRate?: string;
  /** Tedarikçi borcunun orijinal cinsten tutarı — 320 satırının izlenebilirliği. */
  supplierOriginalAmount?: string;
}

/**
 * Rezervasyon iadesi — PLATFORM_BOOKING_REFUNDED (platform defteri).
 *
 * Tahsilat fişinin (`PLATFORM_BOOKING_SETTLED`) **devamıdır, storno'su değil**:
 * para o gün gerçekten alınmıştı ve iade kendi tarihinde gerçekleşir. Fişin
 * denk olmasının tek koşulu:
 *
 *   `commission + supplierReleased + retainedLoss = refundAmount`
 *
 * Üç borç satırının anlamı ayrıdır ve toplanamaz: komisyon **geri alınan
 * gelirdir** (610), serbest kalan tedarikçi payı **düşen borçtur** (320),
 * alıkoyulan ceza **zarardır** (689).
 */
export interface PlatformBookingRefundedEventPayload {
  refundAmount: string; // müşteriye geri giden brüt (108 alacak)
  commission: string; // geri alınan komisyon geliri (610 borç)
  supplierReleased: string; // düşen tedarikçi borcu (320 borç)
  retainedLoss: string; // sağlayıcının alıkoyduğu ceza (689 borç); 0 olabilir
  supplierPartyId: string; // 320 satırının carisi (requiresParty)
  /** Paranın fiilen geri gittiği para birimi (bkz. tahsilat gövdesi). */
  currency: CurrencyType;
  bookingType: string; // HOTEL | TRANSFER | FLIGHT — fiş açıklaması için
  provider: string; // IYZICO | STRIPE — iadenin gittiği kanal
  /** Çevrim yapıldıysa orijinal (satış) para birimi. */
  originalCurrency?: CurrencyType;
  /** Orijinal → gövde para birimi kuru (kilitli, `Decimal(12,6)` string). */
  fxRate?: string;
  /** 320 ve 689 satırlarının orijinal cinsten tutarları. */
  supplierReleasedOriginalAmount?: string;
  retainedLossOriginalAmount?: string;
}

/**
 * Müşteriye iade edilecek tahsilat platform hesabına girdi / iadesi doğrulandı —
 * PLATFORM_RETURNABLE_CHARGE_RECEIVED (`B 108 / A 336`) ve
 * PLATFORM_RETURNABLE_CHARGE_REFUNDED (`B 336 / A 108`). İki olay AYNI gövdeyi taşır.
 */
export interface PlatformReturnableChargeEventPayload {
  amount: string; // iade edilecek tutar (kuruş ölçeği, pozitif)
  currency: CurrencyType; // v1: yalnız TRY (iyzico)
  provider: string; // IYZICO
  chargeReference: string; // iade edilecek tahsilatın sağlayıcı referansı
  reason: string; // RETURNABLE_CHARGE_REASONS
  bookingPaymentId: string;
  refundId: string;
}

/**
 * Stok çıkışı — STOCK_OUT (tüketim / zayi / sayım açığı).
 *
 * Tutar partinin **fiili maliyetidir** (`unitCost × quantity`): envanter
 * değerlemesi parti bazlı fiili maliyet politikasını izliyor, dolayısıyla
 * defterden düşen tutar da o olmak zorundadır — aksi halde 150 bakiyesi ile
 * stok değeri arasında kapanmayan bir fark doğar.
 */
export interface StockOutEventPayload {
  movementId: string;
  productId: string;
  /** USAGE | WASTE | ADJUSTMENT — karşı hesabı bu belirler. */
  movementType: string;
  quantity: string;
  unitCost: string;
  amount: string;
  currency?: CurrencyType;
}

/**
 * Stok girişi — STOCK_IN. **Yalnız** sayım fazlası için üretilir; satın alma
 * girişinin borç kaydı alış faturasından gelir (bkz. stock-movement-ledger).
 */
export interface StockInEventPayload {
  movementId: string;
  productId: string;
  movementType: string;
  quantity: string;
  unitCost: string;
  amount: string;
  currency?: CurrencyType;
}
