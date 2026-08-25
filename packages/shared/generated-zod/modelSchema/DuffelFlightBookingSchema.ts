import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { decimalSchema } from '../../common/decimal';
import { DuffelFlightBookingModeSchema } from '../inputTypeSchemas/DuffelFlightBookingModeSchema'
import { DuffelFlightBookingStatusSchema } from '../inputTypeSchemas/DuffelFlightBookingStatusSchema'
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'

/////////////////////////////////////////
// DUFFEL FLIGHT BOOKING SCHEMA
/////////////////////////////////////////

export const DuffelFlightBookingSchema = z.object({
  mode: DuffelFlightBookingModeSchema,
  status: DuffelFlightBookingStatusSchema,
  currency: CurrencySchema,
  id: z.string(),
  organizationId: z.string(),
  clinicId: z.string(),
  patientId: z.string().nullable(),
  leadId: z.string().nullable(),
  /**
   * Duffel order id (`ord_...`). Hold yolunda ödeme öncesi de dolar.
   */
  duffelOrderId: z.string(),
  /**
   * Havayolu PNR'ı (`booking_reference`) — bilet kesilince dolar.
   */
  bookingReference: z.string().nullable(),
  /**
   * Siparişin açıldığı teklif (`off_...`) — denetim izi.
   */
  offerId: z.string(),
  /**
   * Yolcu listesi (ad/soyad/doğum tarihi/tip) — Duffel'a gönderilen gövdenin kopyası.
   */
  passengers: JsonValueSchema,
  /**
   * Uçuş bacakları: segment, kalkış/varış havalimanı+zamanı, taşıyıcı, uçuş no.
   * Transfer akışı uçuş numarasını buradan okur (hastaya sormak yerine).
   */
  slices: JsonValueSchema,
  totalAmount: decimalSchema("Field 'totalAmount' must be a Decimal. Location: ['Models', 'DuffelFlightBooking']"),
  /**
   * Hold yolunda Duffel'ın verdiği ödeme son tarihi (`payment_required_by`).
   * Bu an geçtiğinde Duffel koltuğu kendi bırakır.
   */
  holdExpiresAt: z.coerce.date().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type DuffelFlightBooking = z.infer<typeof DuffelFlightBookingSchema>

export default DuffelFlightBookingSchema;
