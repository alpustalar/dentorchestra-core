/**
 * `PENDING` bir iade bu süreyi aşarsa "uçuşta" değil "takılmış" sayılır: sağlayıcı çağrısı
 * ya düşmüş ya da süreç çağrının ortasında ölmüştür. Takılmış satır elle çözülebilir ve
 * `iade-askida` taramasında görünür; taze PENDING çözülemez (çağrı hâlâ sürüyor olabilir).
 */
export const BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES = 15;

/**
 * Elle çözümde zorunlu not uzunluğu: "neye dayanarak" boş bırakılamaz (kural 7 damgası).
 * Tek kaynak `@shared`'te (HTTP kapısı ile entity aynı sabiti kullanır — kural 12).
 */
export { BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH } from '@shared/modules/health-tourism/schemas/commands';

/**
 * Sağlayıcıya iletilen tekrar-güvenli anahtar. Entity ve "bekleyen iadeler" okuma modeli
 * aynı fonksiyondan türetir: operatörün panelde aradığı anahtar ile sağlayıcıya giden
 * anahtar farklı üretilirse doğrulama imkânsızlaşır.
 */
export function bookingPaymentRefundIdempotencyKey(params: {
  refundId: string;
  attempt: number;
}): string {
  return `${params.refundId}:${params.attempt}`;
}
