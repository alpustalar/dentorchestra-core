import { z } from 'zod';
import BookingPaymentRefundResolutionSchema from '@shared/generated-zod/inputTypeSchemas/BookingPaymentRefundResolutionSchema';

/**
 * Elle çözümde zorunlu not uzunluğu. Tek kaynak (kural 12): HTTP kapısı (bu şema) ile
 * entity'nin kendi kontrolü aynı sabiti kullanır; kapı kullanım yerinden geniş olamaz.
 */
export const BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH = 10;

/**
 * Sonucu doğrulanamamış (UNCONFIRMED) ya da takılmış (bayat PENDING) bir iadenin operatör
 * tarafından elle kapatılması. Bir PARA kararıdır (kural 7): kim / ne zaman / neye dayanarak
 * kalıcı damgalanır — `note` bu yüzden zorunlu ve anlamlı uzunlukta olmak zorundadır.
 *
 * - `CONFIRMED`: operatör iyzico/Stripe panelinden paranın geri gittiğini doğruladı →
 *   `refundedAt` (iadenin sağlayıcıda gerçekleştiği an) zorunlu; ters kayıt o güne yazılır.
 * - `NOT_REFUNDED`: operatör iadenin gerçekleşmediğini doğruladı → satır `FAILED` olur ve
 *   neden giderilince yeniden denenebilir.
 *
 * Çıktı kümesi üretilmiş `BookingPaymentRefundResolution` enum'undan gelir; elle kopya liste
 * yazılmaz.
 */
export const ResolveBookingPaymentRefundSchema = z
  .object({
    outcome: BookingPaymentRefundResolutionSchema,
    refundedAt: z.coerce.date().optional(),
    providerRefundRef: z.string().trim().min(1).max(200).optional(),
    note: z
      .string()
      .trim()
      .min(
        BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH,
        `Not en az ${BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH} karakter olmalı: neye dayanarak karar verildiği yazılmalı.`
      )
      .max(2000),
  })
  .refine((v) => v.outcome !== 'CONFIRMED' || v.refundedAt !== undefined, {
    path: ['refundedAt'],
    message: 'İade doğrulanıyorsa iadenin gerçekleştiği tarih zorunludur.',
  });
