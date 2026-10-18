import { Decimal } from 'decimal.js';
import { BookingPayment as IBookingPayment } from '@generated/index';
import { Money } from '@src/domain/value-objects/money.vo';

export type BookingPaymentTypeValue = IBookingPayment['bookingType'];
export type BookingPaymentStatusValue = IBookingPayment['status'];
export type BookingPaymentProviderValue = NonNullable<
  IBookingPayment['paidProvider']
>;
export type Currency = IBookingPayment['saleCurrency'];

/** Otel rezervasyonu pax'ı — ödeme sonrası BookHotelCommand'a replay edilir. */
export interface HotelIntentPax {
  roomId: number;
  type: 'AD' | 'CH';
  name: string;
  surname: string;
  age?: number;
}

export interface HotelBookingIntent {
  type: 'HOTEL';
  hotelCode: string;
  hotelName: string;
  checkIn: string; // ISO
  checkOut: string; // ISO
  holderName: string;
  holderSurname: string;
  rooms: Array<{ rateKey: string; paxes: HotelIntentPax[] }>;
  remarks?: string;
}

export interface TransferIntentDetail {
  type: 'FLIGHT' | 'CRUISE' | 'TRAIN';
  direction: 'ARRIVAL' | 'DEPARTURE';
  code: string;
}

export interface TransferBookingIntent {
  type: 'TRANSFER';
  language: string;
  vehicleName: string;
  holderName: string;
  holderSurname: string;
  holderEmail: string;
  holderPhone: string;
  transfers: Array<{
    rateKey: string;
    transferDetails: TransferIntentDetail[];
  }>;
}

/**
 * Uçuş niyeti kendi içinde ikiye ayrılır (hibrit ödeme akışı):
 *
 * - `HOLD`: koltuk tahsilattan ÖNCE Duffel'da tutuldu. Ödeme onayında yapılacak iş
 *   siparişi açmak değil, tutulan siparişi ödemektir → `duffelOrderId` taşınır.
 * - `INSTANT`: havayolu anında ödeme istiyor; sipariş ancak tahsilat onayında,
 *   ödemeyle birlikte açılabilir → teklif (`optionId`) taşınır.
 */
export interface FlightHoldBookingIntent {
  type: 'FLIGHT';
  mode: 'HOLD';
  /** Hold sırasında yaratılan dahili kayıt — ödeme onayında bu güncellenir. */
  flightBookingId: string;
  duffelOrderId: string;
  summary: string;
}

export interface FlightInstantBookingIntent {
  type: 'FLIGHT';
  mode: 'INSTANT';
  /** Cache'teki kısa teklif token'ı; sipariş onayda bununla açılır. */
  optionId: string;
  clinicId: string;
  passengers: FlightIntentPassenger[];
  contactEmail: string;
  contactPhone: string;
  summary: string;
}

export interface FlightIntentPassenger {
  type: 'adult' | 'child' | 'infant_without_seat';
  title?: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  givenName: string;
  familyName: string;
  bornOn: string;
  gender?: 'm' | 'f';
}

export type FlightBookingIntent =
  | FlightHoldBookingIntent
  | FlightInstantBookingIntent;

/** Ödeme onaylanınca sağlayıcıya replay edilecek rezervasyon niyeti. */
export type BookingIntent =
  | HotelBookingIntent
  | TransferBookingIntent
  | FlightBookingIntent;

/** Entity static create() girişi. Tutarlar düz sayı; entity Decimal'e çevirir. */
export interface CreateBookingPaymentProps {
  id?: string;
  bookingType: BookingPaymentTypeValue;
  saleCurrency: Currency;
  saleAmount: number;
  tryAmount: number;
  netAmount: number;
  fxRate: number | null;
  intent: BookingIntent;
  clinicId: string;
  organizationId: string;
  patientId: string | null;
  leadId: string | null;
  conversationId: string | null;
}

/** Sağlayıcının rezervasyonu açarken fiilen ücretlendirdiği maliyet. */
export interface RecordSupplierCostProps {
  /** Kuruş ölçeğinde string (`Money.toApiFormat()`); `number` taşınmaz. */
  amount: string;
  currency: Currency;
}

/**
 * Teklif ↔ fiilî maliyet teşhisi.
 *
 * `netAmount` satış fiyatının türetildiği TEKLİF, `supplierAmount` sağlayıcının
 * FİİLEN ücretlendirdiği tutardır. İkisi arasındaki fark komisyondan düşer, bu
 * yüzden defter fiilî tutardan yazılır ve fark sessiz kalmaz.
 */
export interface SupplierCostAssessment {
  /** Deftere yazılacak tedarikçi payı (fiilî biliniyorsa o, bilinmiyorsa teklif). */
  readonly ledgerAmount: Money;
  /** Defterin yazdığı tutar sağlayıcıdan mı geldi, teklife mi düşüldü? */
  readonly isActual: boolean;
  readonly drift: SupplierCostDrift;
  /** Fiilî maliyet satış fiyatını aşıyor → maliyetin altında satıldı. */
  readonly exceedsSale: boolean;
}

export type SupplierCostDrift =
  /** Fiilî maliyet teklifle birebir aynı. */
  | 'NONE'
  /** Sağlayıcı maliyeti bildirmedi / kayıt ödeme-öncesi akışı baypas etti. */
  | 'UNKNOWN'
  /** Fiilî maliyet başka para biriminde — çıkarılamaz, karşılaştırılamaz. */
  | 'CURRENCY_MISMATCH'
  /** Fiilî maliyet teklifle aynı para biriminde ama farklı tutarda. */
  | 'DIFFERENT';

/**
 * Sağlayıcının iptal nedeniyle **alıkoyduğu** tutar (iptal cezası).
 *
 * `null` ile `0` farklıdır: `0` "sağlayıcı ceza almadı, borcun tamamı düştü",
 * `null` "sağlayıcı bildirmedi" demektir. İkincisinde defter cezasız ters kayıt
 * yazar ve fark alarmla duyurulur — 0 varsaymak sessizce tedarikçi borcunu
 * eksik düşürür ve zararı hiç tanımaz.
 */
export interface SupplierRetainedCost {
  /** Kuruş ölçeğinde string (`Money.toApiFormat()`); `number` taşınmaz. */
  amount: string;
  currency: Currency;
}

/**
 * `markRefunded` girişi. `retained` **zorunlu** (null olabilir ama atlanamaz):
 * her iade çağrısı "sağlayıcı ceza aldı mı" sorusunu yanıtlamak zorundadır,
 * yoksa cevap sessizce "hayır"a düşer.
 */
export interface MarkRefundedProps {
  reason: string;
  retained: SupplierRetainedCost | null;
}

/**
 * İade ters kaydının sayıları — tek yerde hesaplanır.
 *
 * Tahsilat fişi `B 108 / A 601 + A 320` yazmıştı. İade bunun aynası değil
 * **devamıdır**: müşteriye para geri gider (108 alacak), komisyon geri alınır
 * (610 borç — 601'i eksiye çekmek yerine satıştan iade hesabı), tedarikçi borcu
 * yalnız **serbest kalan** kadar düşer (320 borç) ve sağlayıcının alıkoyduğu
 * ceza platformun zararı olarak tanınır (689 borç).
 *
 * Dört büyüklük tek yerde türetilir çünkü aralarındaki eşitlik fişin denk
 * olmasının tek koşuludur: `commission + supplierReleased + retainedLoss`
 * = `refundAmount`.
 */
export interface BookingRefundAssessment {
  /** Müşteriye geri giden tutar (v1: satış fiyatının tamamı). */
  readonly refundAmount: Money;
  /** Geri alınan komisyon geliri (610). */
  readonly commission: Money;
  /** Serbest kalan tedarikçi borcu (320) = defterin yazdığı maliyet − ceza. */
  readonly supplierReleased: Money;
  /** Platformun üstlendiği iptal cezası (689); bilinmiyorsa sıfır. */
  readonly retainedLoss: Money;
  /** Ceza sağlayıcıdan öğrenildi mi? `false` → cezasız varsayıldı. */
  readonly retainedKnown: boolean;
  /** Ceza başka para biriminde geldi → karşılaştırılamadı, cezasız varsayıldı. */
  readonly retainedCurrencyMismatch: boolean;
  /** Ceza, defterin yazdığı tedarikçi maliyetini aşıyor → 320 negatife düşer. */
  readonly retainedExceedsSupplier: boolean;
  /** Komisyon negatif: tahsilat fişi hiç yazılmamıştı (maliyetin altında satış). */
  readonly commissionIsNegative: boolean;
}

/**
 * Platform defterine köprülenmesi **gereken** rezervasyon hareketi (okuma
 * modeli). Aday olma koşulu `bookingReference`'ın dolu olması: rezervasyon
 * fiilen açıldıysa tahsilat fişi borçludur. `markBooked` hiç çalışmadıysa
 * (PAID → FAILED → REFUNDED yolu) ileri fiş de borçlu değildir, çünkü o parayla
 * hiçbir tedarikçi borcu doğmamıştır.
 */
export interface BridgeableBookingLedgerRow {
  bookingPaymentId: string;
  clinicId: string;
  bookingType: BookingPaymentTypeValue;
  status: BookingPaymentStatusValue;
  /** Tahsilatın geçtiği kanal; rezervasyon açıldıysa dolu olmak zorunda. */
  paidProvider: BookingPaymentProviderValue | null;
  paidAt: Date | null;
  /** Doluysa iade de gerçekleşti → geri yön fişi de borçlu. */
  refundedAt: Date | null;
}

/**
 * Pencere `paidAt` **veya** `refundedAt`'e uygulanır: iki yön iki ayrı tarihte
 * yaşıyor ve tek tarihe bakmak, geçen dönemde tahsil edilip bu dönemde iade
 * edilen bir rezervasyonun eksik fişini görünmez yapardı.
 */
export interface FindBridgeableBookingPaymentsFilter {
  from: Date;
  to: Date;
  clinicId?: string;
}

/** initiate sonrası üretilen sağlayıcı link bilgileri. */
export interface BookingPaymentLinks {
  iyzicoConversationId?: string | null;
  iyzicoToken?: string | null;
  iyzicoUrl?: string | null;
  stripeSessionId?: string | null;
  stripeUrl?: string | null;
}

/**
 * Fişin **para birimi temeli**: paranın fiilen hangi cinste hareket ettiği ve
 * satış cinsinden o cinse çeviren kur.
 *
 * Neden gerekli: satış fiyatı EUR cinsinden belirlenir ama iyzico linki hastaya
 * **TRY** çeker (`tryAmount = saleAmount × fxRate`, kur link üretilirken
 * kilitlenir). Defteri satış cinsinden beyan etmek, posting'in kuru **dışarıdan
 * yeniden türetmesine** yol açar (TCMB, olay tarihi) — o kur link anındaki
 * kurdan farklı olduğu an 108 hesabı **gelmeyen bir parayı** gösterir. Kasa
 * hesabı yorum kabul etmez: içine giren tutar, fiilen giren tutardır.
 */
export interface BookingLedgerBasis {
  /** Fişin para birimi = paranın fiilen hareket ettiği birim. */
  readonly currency: Currency;
  /** Satış cinsinden fiş cinsine kilitli kur; çevrim yoksa `null`. */
  readonly fxRate: Decimal | null;
  /** Çevrim yapıldıysa satış birimi (izlenebilirlik), yoksa `null`. */
  readonly originalCurrency: Currency | null;
}

/**
 * Tahsilat fişinin sayıları — **fiş para biriminde**.
 *
 * `commission` bilerek **artık (plug)** olarak türetilir: `sale − supplier`.
 * Üç tutarı ayrı ayrı çevirmek kuruş düzeyinde artık bırakır ve fişi dengesiz
 * yapardı; komisyon artık olduğunda eşitlik tanım gereği sağlanır.
 */
export interface BookingSettledLedgerAmounts {
  readonly currency: Currency;
  /** Müşteriden fiilen tahsil edilen tutar (108 borç). */
  readonly sale: Money;
  /** Tedarikçi borcu (320 alacak), fiş cinsine çevrilmiş. */
  readonly supplier: Money;
  /** Platform komisyonu (601 alacak) = `sale − supplier`. */
  readonly commission: Money;
  /** Çevrim yapıldıysa kilitli kur — yevmiye satırının izlenebilirliği için. */
  readonly fxRate: Decimal | null;
  readonly originalCurrency: Currency | null;
  /** Tedarikçi borcunun orijinal (satış) cinsinden tutarı; çevrim yoksa `null`. */
  readonly supplierOriginal: Money | null;
}

/**
 * İade ters kaydının sayıları — **fiş para biriminde**.
 *
 * `commission` yine artıktır: `refundAmount − supplierPosted`. Böylece
 * `commission + supplierReleased + retainedLoss = refundAmount` eşitliği
 * (fişin denk olmasının tek koşulu) çevrim yuvarlamasından bağımsız tutar.
 */
export interface BookingRefundedLedgerAmounts {
  readonly currency: Currency;
  /** Müşteriye fiilen geri giden tutar (108 alacak). */
  readonly refundAmount: Money;
  /** Geri alınan komisyon (610 borç). */
  readonly commission: Money;
  /** Serbest kalan tedarikçi borcu (320 borç). */
  readonly supplierReleased: Money;
  /** Üstlenilen iptal cezası (689 borç). */
  readonly retainedLoss: Money;
  readonly fxRate: Decimal | null;
  readonly originalCurrency: Currency | null;
  readonly supplierReleasedOriginal: Money | null;
  readonly retainedLossOriginal: Money | null;
}
