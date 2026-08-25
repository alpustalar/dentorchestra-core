import { z } from 'zod';
import { CancelFlightBookingSchema } from '../../schemas/commands/cancel-flight-booking.schema';

export type CancelFlightBooking = z.infer<typeof CancelFlightBookingSchema>;
