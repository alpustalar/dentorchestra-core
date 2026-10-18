/**
 * Tahsilat / ödeme yöntemleri — **tek kaynak**.
 *
 * Yöntem yalnız bir etiket değil, **hangi hazır değer hesabının** hareket
 * göreceğini belirleyen bir muhasebe kararıdır (nakit → 100 Kasa, havale → 102
 * Bankalar, kart → 108 Diğer Hazır Değerler). Bu yüzden kabul kümesi tek yerde
 * durur ve hem yazma kapısı (DTO + ekonomik olay gövde doğrulaması) hem
 * kullanım yeri (posting kuralı) onu import eder — CLAUDE.md finans kuralı 12.
 *
 * Eskiden gövde doğrulaması `z.string().min(1)` idi ve posting kuralı `CASH`
 * dışındaki her değeri **sessizce 102 Bankalar'a** yazıyordu. Fiş dengeli
 * olduğu için hata hiçbir bütünlük kontrolüne yakalanmazdı; sonucu, hiçbir banka
 * ekstresiyle eşleşmeyecek bir 102 hareketi (mutabakatta sonsuza dek UNMATCHED)
 * ve eksik görünen kasa/kart bakiyesidir.
 */

/** Tahsilatta (bize para girişi) kabul edilen yöntemler. */
export const INBOUND_PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'POS_CARD',
] as const;

/**
 * Ödemede (bizden para çıkışı) kabul edilen yöntemler.
 *
 * `POS_CARD` bilinçli olarak **yok**: 108 (Diğer Hazır Değerler) bankadan
 * tahsil edilmeyi bekleyen **kart alacağımızı** taşır; tedarikçiye kartla ödeme
 * onu azaltmaz — kurumsal kart borcu ya da banka çıkışıdır. Kümeyi geniş tutmak
 * çıkışı yanlış hesaba yazardı.
 */
export const OUTBOUND_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER'] as const;

export type InboundPaymentMethod = (typeof INBOUND_PAYMENT_METHODS)[number];
export type OutboundPaymentMethod = (typeof OUTBOUND_PAYMENT_METHODS)[number];
export type PaymentMethodCode = InboundPaymentMethod;
