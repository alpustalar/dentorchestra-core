import { z } from 'zod';
import { Decimal } from 'decimal.js';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';
import { FinancialEventTypeSchema } from '@shared';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import {
  INBOUND_PAYMENT_METHODS,
  OUTBOUND_PAYMENT_METHODS,
  PURCHASE_INVOICE_LINE_ACCOUNT_CODES,
} from '@shared/common/constants';
import { RETURNABLE_CHARGE_REASONS } from '@modules/finance/shared/domain/constants/returnable-charge.constant';
import { CHARGEBACK_FUNDS_CHANNELS } from '@modules/finance/shared/domain/constants/chargeback-funds.constant';

/**
 * Ekonomik olay gövdelerinin (payload) yazma-anı sözleşmesi.
 *
 * **Neden burada, neden yazma anında:** `FinancialEvent` append-only'dir — bir
 * kez yazılan gövde asla düzeltilemez. Posting kuralları gövdeyi çalışma anında
 * `as unknown as XPayload` ile **doğrulamadan** okuyor; eksik ya da yanlış tipli
 * bir alan iki sonuçtan birini veriyor:
 *   1. `new Decimal(undefined)` patlar → fiş hiç üretilmez, olay defterde öksüz
 *      kalır (mizan eksik, kimse fark etmez), ya da
 *   2. tutar sessizce sıfırlanır → defterde **yanlış** bir fiş oluşur.
 * İkisi de yasal kayıt açısından kabul edilemez. Bu yüzden gövde, kalıcılaşmadan
 * önce, olay tipinin posting kuralının okuduğu alanlara göre doğrulanır.
 *
 * Şemalar **gevşektir**: bilinmeyen ek alanlar korunur (zod varsayılanı) çünkü
 * gövde olaya özgü serbest veri de taşıyabilir. Zorunlu olan yalnız kuralın
 * fiilen okuduğu alanlardır.
 *
 * Kuralı olmayan olay tipleri (`MANUAL_JOURNAL`, `DEPRECIATION`, …) bu haritada
 * yer almaz ve doğrulanmaz — onlar için henüz bir fiş sözleşmesi yoktur.
 */

/**
 * Para tutarı: Decimal hassasiyetini korumak için **string** (sayı DEĞİL).
 *
 * Tipin doğruluğunu zorlar — `undefined`, `null`, sayı, üstel gösterim ve (en
 * tehlikelisi) yanlışlıkla geçirilmiş Value Object burada durdurulur — ve
 * **kuruş ölçeğini**: en çok iki ondalık hane.
 *
 * Neden iki hane (CLAUDE.md finans kuralı 12 — kapı, kullanım yerinden geniş
 * olamaz): posting kuralları her fiş satırını `toFixed(2)` ile yazıyor ve
 * `JournalLine` kolonları `Decimal(14,2)`. Üçüncü basamak taşıyan bir gövde,
 * satırlar ayrı ayrı yuvarlandığında Σborç = Σalacak özdeşliğini bir kuruş
 * kaydırabiliyor (ör. komisyon 10.005 + tedarikçi 89.995 = satış 100.00 → fiş
 * 10.01 + 90.00 ≠ 100.00) ve fiş "dengesiz" diye reddediliyor. Olay defteri
 * append-only olduğu için gövde **düzeltilemez**: olay sonsuza dek fişsiz kalır,
 * backfill her turda aynı hatayla patlar. Bu yüzden ret, kaynağın tutarı hâlâ
 * düzeltebildiği yerde — yazma anında — verilir.
 */
const amount = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    'Tutar en çok iki ondalık haneli, işaretsiz ondalık string olmalı (ör. "100.00")'
  );

/**
 * Döviz kuru: `Decimal(12,6)` ölçeğinde **string**.
 *
 * Tutarlar gibi string taşınır (kayan nokta kuru 38.1234 → 38.12340000000001
 * yapıp çevrilmiş tutarı kuruş kaydırabilir) ve pozitif olmak zorundadır: sıfır
 * ya da negatif kur, çevrilmiş satırı sessizce sıfırlar/ters çevirir ve fiş
 * yine denk göründüğü için hiçbir kontrol uyarmaz.
 */
const fxRate = z
  .string()
  .regex(
    /^\d+(\.\d{1,6})?$/,
    'Kur en çok altı ondalık haneli, işaretsiz ondalık string olmalı (ör. "38.123456")'
  )
  .refine((v) => Number(v) > 0, 'Kur sıfırdan büyük olmalı');

/** Pozitif para tutarı — sıfır tutarlı fiş satırı muhasebe kuralınca geçersizdir. */
const positiveAmount = amount.refine(
  (v) => Number(v) > 0,
  'Tutar sıfırdan büyük olmalı'
);

/** İşaretli tutar (kasa sayım farkı gibi eksi olabilen alanlar). */
const signedAmount = z
  .string()
  .regex(
    /^-?\d+(\.\d{1,2})?$/,
    'Tutar en çok iki ondalık haneli, işaretli ondalık string olmalı (ör. "-12.50")'
  );

const partyId = z.uuid('Cari (party) kimliği UUID olmalı');
const currency = CurrencySchema.optional();

const paymentReceived = z.object({
  // Kabul kümesi tek kaynaktan: kapı, kullanım yerinden (posting kuralının
  // hesap eşlemesi) daha geniş olamaz — CLAUDE.md finans kuralı 12. `z.string()`
  // iken `method: 'CHECK'` yazılabiliyor ve tahsilat sessizce 102 Bankalar'a
  // düşüyordu (hiçbir ekstreyle eşleşmeyen hareket + eksik kasa bakiyesi).
  method: z.enum(INBOUND_PAYMENT_METHODS),
  amount: positiveAmount,
  partyId,
  currency,
});

/**
 * İade gövdesi: tahsilatın **aynası**, ama yöntem kümesi `INBOUND`'dur.
 *
 * Para geri giderken enstrüman değişmez: kartla alınan kartla, nakit alınan
 * nakit iade edilir. `OUTBOUND_PAYMENT_METHODS` bilinçli olarak kart taşımıyor
 * (satıcıya kartla ödeme yapılmaz) — o kümeyi kullanmak her kart iadesini
 * "eşlenmemiş yöntem" diye reddederdi.
 */
const paymentRefunded = z.object({
  method: z.enum(INBOUND_PAYMENT_METHODS),
  amount: positiveAmount,
  partyId,
  currency,
  /** Ters kaydın dayandığı orijinal tahsilat izi — fiş açıklamasına geçer. */
  reference: z.string().optional(),
});

const paymentMade = z.object({
  method: z.enum(OUTBOUND_PAYMENT_METHODS),
  amount: positiveAmount,
  partyId,
  currency,
  reference: z.string().optional(),
});

const salesInvoiceIssued = z.object({
  partyId,
  netTotal: amount,
  vatTotal: amount,
  grandTotal: positiveAmount,
  revenueAccountCode: z.string().min(1).optional(),
  withholdingTotal: amount.optional(),
  currency,
});

const purchaseInvoiceReceived = z.object({
  partyId,
  netTotal: amount,
  vatTotal: amount,
  grandTotal: positiveAmount,
  /**
   * Borcun yazılacağı hesap. Serbest metin iken `102` gibi bir kod gövdeye girip
   * dengeli ama yanlış bir fiş üretiyordu; olay defteri append-only olduğu için
   * yazılan gövde düzeltilemez. Kabul kümesi DTO ve posting kuralıyla AYNI sabittir
   * (CLAUDE.md finans kuralı 12).
   */
  lineAccountCode: z.enum(PURCHASE_INVOICE_LINE_ACCOUNT_CODES),
  currency,
});

const payrollAccrued = z.object({
  partyId,
  grossSalary: positiveAmount,
  employerSgk: amount,
  netPayable: amount,
  taxWithholding: amount,
  employeeSgk: amount,
});

const cashSessionClosed = z.object({
  bankDepositTotal: amount,
  expenseTotal: amount,
  difference: signedAmount,
  currency,
});

/**
 * Sağlayıcı hesap kapaması — `B 102 net + B 653 komisyon / A 108 brüt`.
 *
 * Üç tutar **birlikte** gelir ve `brüt = net + komisyon` birebir tutmak zorundadır:
 * fişin dengesi bu eşitliktir. Gövde append-only olduğu için ret, kaynağın tutarı
 * hâlâ düzeltebildiği yerde (yazma anında) verilir — aksi halde olay sonsuza kadar
 * fişlenemez kalır.
 */
const providerSettlementReceived = z
  .object({
    grossAmount: positiveAmount,
    netAmount: positiveAmount,
    commissionAmount: amount,
    currency: CurrencySchema,
    provider: z.string().min(1),
    reference: z.string().min(1),
  })
  .refine(
    (data) =>
      new Decimal(data.grossAmount).equals(
        new Decimal(data.netAmount).plus(new Decimal(data.commissionAmount))
      ),
    'Brüt tutar net + komisyona eşit olmalı (fişin dengesi bu eşitliktir).'
  );

/**
 * Kart itirazı gövdeleri. Kanal kabul kümesi **tek sabitten** gelir
 * (`CHARGEBACK_FUNDS_CHANNELS`): kapı (burası), kullanım yeri (posting kuralı
 * hesap eşlemesi) ve DB enum'u aynı kümeyi okur — kural 12.
 *
 * Para birimi **zorunlu** (hesap kapamasındaki gibi): itiraz fişi sağlayıcının
 * kestiği paranın cinsinden yazılır, varsayılana düşmez.
 */
const chargebackFundsChannel = z.enum(CHARGEBACK_FUNDS_CHANNELS);

/**
 * Açılış: `B 127 tutar / A 108|102 tutar` (+ ücret > 0 ise `B 653 ücret / A 108|102 ücret`).
 * Ücret sıfır olabilir (ücretsiz itiraz) — o zaman 653 satırı yazılmaz.
 */
const cardChargebackOpened = z.object({
  amount: positiveAmount,
  feeAmount: amount,
  fundsChannel: chargebackFundsChannel,
  currency: CurrencySchema,
  provider: z.string().min(1),
  caseReference: z.string().min(1),
});

/** Kazanıldı: `B 108|102 tutar / A 127 tutar`. */
const cardChargebackWon = z.object({
  amount: positiveAmount,
  fundsChannel: chargebackFundsChannel,
  currency: CurrencySchema,
  provider: z.string().min(1),
  caseReference: z.string().min(1),
});

/**
 * Kaybedildi: `B 120 (hasta) tutar / A 127 tutar`. 120 `requiresParty` taşıdığı
 * için cari **zorunlu**: gövde append-only olduğundan eksik cari, postlanamayan
 * ölümsüz bir olay bırakırdı (bkz. `platformBookingSettled` gerekçesi).
 */
const cardChargebackLostBase = {
  amount: positiveAmount,
  currency: CurrencySchema,
  provider: z.string().min(1),
  caseReference: z.string().min(1),
};

/**
 * İki varyant, ikisi de KATI (`strict`): eski (hasta) olaylar `platformLoss` taşımaz ve cariyi
 * zorunlu kılar; platform varyantı cari TAŞIYAMAZ. Ayrım açık bir işarettir — cari yokluğundan
 * türetilen platform zararı, cari unutulmuş bir hasta itirazını sessizce 659.01'e yazardı.
 */
const cardChargebackLost = z.union([
  z.object({ ...cardChargebackLostBase, partyId }).strict(),
  z
    .object({ ...cardChargebackLostBase, platformLoss: z.literal(true) })
    .strict(),
]);

const platformBookingSettled = z
  .object({
    saleAmount: positiveAmount,
    supplierAmount: amount,
    commission: amount,
    // 320 `requiresParty` → carisiz satır fişe dönüşmez. Kapı burada: gövde
    // yazıldıktan sonra düzeltilemediği için eksik cari, postlanamayan ölümsüz
    // bir olay bırakırdı (kural 12 — kapı kullanım yerinden geniş olamaz).
    supplierPartyId: z.uuid('Tedarikçi carisi UUID olmalı'),
    currency: CurrencySchema,
    bookingType: z.string().min(1),
    provider: z.string().min(1),
    // Yabancı satış + iyzico (TRY çekilir) → gövde TRY'dir ve kilitli kur ile
    // orijinal tedarikçi borcu izlenebilirlik için taşınır. Üçü ya birlikte
    // gelir ya hiç gelmez: ikisi gelip biri eksik kalırsa 320 satırının EUR
    // karşılığı kurtarılamaz hâle gelir (gövde append-only).
    originalCurrency: CurrencySchema.optional(),
    fxRate: fxRate.optional(),
    supplierOriginalAmount: amount.optional(),
  })
  .refine(
    (v) =>
      [v.originalCurrency, v.fxRate, v.supplierOriginalAmount].every(
        (f) => f === undefined
      ) ||
      [v.originalCurrency, v.fxRate, v.supplierOriginalAmount].every(
        (f) => f !== undefined
      ),
    'Yabancı para temeli eksiksiz olmak zorunda: originalCurrency + fxRate + supplierOriginalAmount ya birlikte gelir ya hiç gelmez'
  );

/**
 * İade fişi. `commission`/`supplierReleased`/`retainedLoss` **sıfır olabilir**
 * (cezasız iptal → retainedLoss 0; tamamı cezalı → supplierReleased 0), bu
 * yüzden `amount` kullanılır; yalnız geri giden tutar pozitif olmak zorundadır.
 */
const platformBookingRefunded = z
  .object({
    refundAmount: positiveAmount,
    commission: amount,
    supplierReleased: amount,
    retainedLoss: amount,
    supplierPartyId: z.uuid('Tedarikçi carisi UUID olmalı'),
    currency: CurrencySchema,
    bookingType: z.string().min(1),
    provider: z.string().min(1),
    // Bkz. tahsilat gövdesi: iade de fiilen hareket eden para biriminde yazılır.
    originalCurrency: CurrencySchema.optional(),
    fxRate: fxRate.optional(),
    supplierReleasedOriginalAmount: amount.optional(),
    retainedLossOriginalAmount: amount.optional(),
  })
  .refine((v) => {
    const basis = [
      v.originalCurrency,
      v.fxRate,
      v.supplierReleasedOriginalAmount,
      v.retainedLossOriginalAmount,
    ];
    return (
      basis.every((f) => f === undefined) || basis.every((f) => f !== undefined)
    );
  }, 'Yabancı para temeli eksiksiz olmak zorunda: originalCurrency + fxRate + orijinal tutarlar ya birlikte gelir ya hiç gelmez');

/**
 * Müşteriye iade edilecek tahsilat (çift çekim / başarısız rezervasyon). İki olay tipi (alındı /
 * iade doğrulandı) aynı gövdeyi taşır. `currency` v1'de yalnız TRY: iyzico TRY çeker ve iade
 * eder; yabancı para (Stripe) bu akışa bilinçli alınmadı (Stripe kapalı, kur farkı tanınmıyor).
 */
const platformReturnableCharge = z.object({
  amount: positiveAmount,
  currency: z.literal(CurrencySchema.enum.TRY),
  provider: z.string().min(1),
  chargeReference: z.string().min(1),
  reason: z.enum(RETURNABLE_CHARGE_REASONS),
  bookingPaymentId: z.uuid('Ödeme kaydı kimliği UUID olmalı'),
  refundId: z.uuid('İade kaydı kimliği UUID olmalı'),
});

/** Miktar: stok kolonlarının ölçeği (3 ondalık) — tutar değil, adet. */
const quantity = z
  .string()
  .regex(
    /^\d+(\.\d{1,3})?$/,
    'Miktar en çok üç ondalık haneli, işaretsiz ondalık string olmalı (ör. "2.500")'
  );

/**
 * Stok hareketinin defter gövdesi (giriş/çıkış aynı şekil).
 *
 * `amount` fişe giden tutardır ve **pozitif** olmak zorundadır: sıfır maliyetli
 * bir hareket (bedelsiz numune) için fiş üretilmez — üretici onu hiç
 * köprülemez, buraya gelirse kapıda durur.
 */
const stockMovementPosted = z.object({
  movementId: z.uuid('Hareket kimliği UUID olmalı'),
  productId: z.uuid('Ürün kimliği UUID olmalı'),
  movementType: z.string().min(1),
  quantity,
  unitCost: positiveAmount,
  amount: positiveAmount,
  currency,
});

const { enum: T } = FinancialEventTypeSchema;

export const FINANCIAL_EVENT_PAYLOAD_SCHEMAS: Partial<
  Record<FinancialEventType, z.ZodType>
> = {
  [T.PAYMENT_RECEIVED]: paymentReceived,
  [T.PAYMENT_REFUNDED]: paymentRefunded,
  [T.PAYMENT_MADE]: paymentMade,
  [T.SALES_INVOICE_ISSUED]: salesInvoiceIssued,
  [T.PURCHASE_INVOICE_RECEIVED]: purchaseInvoiceReceived,
  [T.PAYROLL_ACCRUED]: payrollAccrued,
  [T.CASH_SESSION_CLOSED]: cashSessionClosed,
  [T.PROVIDER_SETTLEMENT_RECEIVED]: providerSettlementReceived,
  [T.CARD_CHARGEBACK_OPENED]: cardChargebackOpened,
  [T.CARD_CHARGEBACK_WON]: cardChargebackWon,
  [T.CARD_CHARGEBACK_LOST]: cardChargebackLost,
  [T.PLATFORM_BOOKING_SETTLED]: platformBookingSettled,
  [T.PLATFORM_BOOKING_REFUNDED]: platformBookingRefunded,
  [T.PLATFORM_RETURNABLE_CHARGE_RECEIVED]: platformReturnableCharge,
  [T.PLATFORM_RETURNABLE_CHARGE_REFUNDED]: platformReturnableCharge,
  [T.STOCK_OUT]: stockMovementPosted,
  [T.STOCK_IN]: stockMovementPosted,
};

/**
 * Gövdeyi olay tipine göre doğrular. Sözleşmesi olmayan tipler serbesttir.
 * Dönüş: sorun listesi (boşsa geçerli).
 */
export function validateFinancialEventPayload(
  type: FinancialEventType,
  payload: unknown
): string[] {
  const schema = FINANCIAL_EVENT_PAYLOAD_SCHEMAS[type];
  if (!schema) return [];

  const result = schema.safeParse(payload);
  if (result.success) return [];

  return result.error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join('.')}: ${issue.message}`
      : issue.message
  );
}
