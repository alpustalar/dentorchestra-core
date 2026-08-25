import { z } from 'zod';

export const CancelFlightBookingSchema = z.object({
  /** Dahili rezervasyon kaydının id'si (Duffel order id değil). */
  bookingId: z.uuid(),
  reason: z.string().max(500).optional(),
});
