import { z } from 'zod';
import { SearchFlightsSchema } from '../../schemas/queries/search-flights.schema';

export type SearchFlights = z.infer<typeof SearchFlightsSchema>;
