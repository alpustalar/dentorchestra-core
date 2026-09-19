import { createZodDto } from 'nestjs-zod';
import { SearchFlightsSchema } from '../../schemas/queries/search-flights.schema';

export class SearchFlightsDto extends createZodDto(SearchFlightsSchema) {}
