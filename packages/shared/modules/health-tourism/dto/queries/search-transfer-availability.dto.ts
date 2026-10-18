import { createZodDto } from 'nestjs-zod';
import { SearchTransferAvailabilitySchema } from '../../schemas/queries/search-transfer-availability.schema';

export class SearchTransferAvailabilityDto extends createZodDto(
  SearchTransferAvailabilitySchema
) {}
