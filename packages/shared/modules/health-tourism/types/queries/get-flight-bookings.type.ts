import { z } from 'zod';
import { GetFlightBookingsSchema } from '../../schemas/queries/get-flight-bookings.schema';

export type GetFlightBookings = z.infer<typeof GetFlightBookingsSchema>;
