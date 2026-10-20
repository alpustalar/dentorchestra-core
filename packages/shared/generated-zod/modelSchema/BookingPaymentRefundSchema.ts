import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { BookingPaymentRefundKindSchema } from '../inputTypeSchemas/BookingPaymentRefundKindSchema'
import { BookingPaymentRefundOriginSchema } from '../inputTypeSchemas/BookingPaymentRefundOriginSchema'
import { BookingPaymentProviderSchema } from '../inputTypeSchemas/BookingPaymentProviderSchema'
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { BookingPaymentRefundStatusSchema } from '../inputTypeSchemas/BookingPaymentRefundStatusSchema'
import { BookingPaymentRefundResolutionSchema } from '../inputTypeSchemas/BookingPaymentRefundResolutionSchema'

/////////////////////////////////////////
// BOOKING PAYMENT REFUND SCHEMA
/////////////////////////////////////////

/**
 * Bir tahsilatın müşteriye geri götürülmesi — TEK satır = TEK iade girişimi zinciri.
 * `booking_payments`'a iade kolonu eklenmedi: çift çekim rezervasyonun kendi tahsilatı
 * değildir (kendi satırı gerekir) ve iade tutarının tek kaynağı burasıdır (kural 12/14).
 * `(provider, charge_provider_ref)` unique: aynı tahsilat iki kez iade edilemez; sahiplenme
 * olay defterinin dedupe'u değil bu satırdır (dedupe mevcut kimliği sessizce döner).
 */
export const BookingPaymentRefundSchema = z.object({
  kind: BookingPaymentRefundKindSchema,
  origin: BookingPaymentRefundOriginSchema,
  provider: BookingPaymentProviderSchema,
  currency: CurrencySchema,
  status: BookingPaymentRefundStatusSchema,
  resolution: BookingPaymentRefundResolutionSchema.nullable(),
  id: z.string(),
  bookingPaymentId: z.string(),
  clinicId: z.string(),
  organizationId: z.string(),
  chargeProviderRef: z.string(),
  amount: decimalSchema("Field 'amount' must be a Decimal. Location: ['Models', 'BookingPaymentRefund']"),
  attemptCount: z.number().int(),
  reason: z.string().nullable(),
  failureReason: z.string().nullable(),
  requestedAt: z.coerce.date().nullable(),
  requestedById: z.string().nullable(),
  providerRefundRef: z.string().nullable(),
  refundedAt: z.coerce.date().nullable(),
  resolvedById: z.string().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  resolutionNote: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type BookingPaymentRefund = z.infer<typeof BookingPaymentRefundSchema>

export default BookingPaymentRefundSchema;
