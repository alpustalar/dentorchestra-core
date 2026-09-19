import { z } from 'zod';
import {
  BookFlightSchema,
  FlightPassengerSchema,
} from '../../schemas/commands/book-flight.schema';

export type BookFlight = z.infer<typeof BookFlightSchema>;
export type FlightPassenger = z.infer<typeof FlightPassengerSchema>;
