import { GetProviderCalendarSchema } from '../../schemas/queries';
import { createZodDto } from 'nestjs-zod';

export class GetProviderCalendarDto extends createZodDto(
  GetProviderCalendarSchema
) {
  
}
