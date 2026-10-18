import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { decimalSchema } from '../../common/decimal';
import { BookingPaymentTypeSchema } from '../inputTypeSchemas/BookingPaymentTypeSchema'
import { BookingPaymentStatusSchema } from '../inputTypeSchemas/BookingPaymentStatusSchema'
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { BookingPaymentProviderSchema } from '../inputTypeSchemas/BookingPaymentProviderSchema'

/////////////////////////////////////////
// BOOKING PAYMENT SCHEMA
/////////////////////////////////////////

/**
 * Sağlık turizmi (otel/transfer) rezervasyonu için ÖDEME-ÖNCE (payment-first) tahsilat
 * kaydı. Hasta ödeme yapmadan HotelBeds'e rezervasyon AÇILMAZ (klinik maliyeti + iptal
 * riski). İki link üretilir: iyzico (TRY, yurt içi) + Stripe (EUR/USD, yurt dışı). Biri
 * ödenince webhook `intent`'i HotelBeds'e replay eder, diğer link iptal/expire edilir.
 */
export const BookingPaymentSchema = z.object({
  bookingType: BookingPaymentTypeSchema,
  status: BookingPaymentStatusSchema,
  saleCurrency: CurrencySchema,
  supplierCurrency: CurrencySchema.nullable(),
  paidProvider: BookingPaymentProviderSchema.nullable(),
  supplierRetainedCurrency: CurrencySchema.nullable(),
  id: z.string(),
  saleAmount: decimalSchema("Field 'saleAmount' must be a Decimal. Location: ['Models', 'BookingPayment']"),
  tryAmount: decimalSchema("Field 'tryAmount' must be a Decimal. Location: ['Models', 'BookingPayment']"),
  netAmount: decimalSchema("Field 'netAmount' must be a Decimal. Location: ['Models', 'BookingPayment']"),
  fxRate: decimalSchema("Field 'fxRate' must be a Decimal. Location: ['Models', 'BookingPayment']").nullable(),
  supplierAmount: decimalSchema("Field 'supplierAmount' must be a Decimal. Location: ['Models', 'BookingPayment']").nullable(),
  intent: JsonValueSchema,
  iyzicoConversationId: z.string().nullable(),
  iyzicoToken: z.string().nullable(),
  iyzicoUrl: z.string().nullable(),
  stripeSessionId: z.string().nullable(),
  stripeUrl: z.string().nullable(),
  paidProviderRef: z.string().nullable(),
  paidAt: z.coerce.date().nullable(),
  supplierRetainedAmount: decimalSchema("Field 'supplierRetainedAmount' must be a Decimal. Location: ['Models', 'BookingPayment']").nullable(),
  refundedAt: z.coerce.date().nullable(),
  refundReason: z.string().nullable(),
  bookingReference: z.string().nullable(),
  bookingId: z.string().nullable(),
  failureReason: z.string().nullable(),
  clinicId: z.string(),
  organizationId: z.string(),
  patientId: z.string().nullable(),
  leadId: z.string().nullable(),
  conversationId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type BookingPayment = z.infer<typeof BookingPaymentSchema>

export default BookingPaymentSchema;
