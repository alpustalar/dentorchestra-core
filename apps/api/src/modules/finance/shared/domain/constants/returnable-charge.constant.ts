/**
 * Müşteriye İADE EDİLMESİ gereken, gelir olmayan tahsilatların nedenleri.
 *
 * - `UNCLAIMED_CHARGE`: aynı rezervasyon için ikinci kez çekilen para (çift çekim).
 * - `BOOKING_FAILED`: ödeme alındı ama rezervasyon açılamadı.
 *
 * Kabul kümesi TEK sabittedir (kural 12): olay gövde şeması (yazma kapısı) ile köprü
 * (kullanım yeri) aynı listeyi import eder; kopya liste yazılmaz.
 */
export const RETURNABLE_CHARGE_REASONS = [
  'UNCLAIMED_CHARGE',
  'BOOKING_FAILED',
] as const;

export type ReturnableChargeReason = (typeof RETURNABLE_CHARGE_REASONS)[number];
