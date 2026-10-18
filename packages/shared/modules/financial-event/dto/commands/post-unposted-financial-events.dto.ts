import { createZodDto } from 'nestjs-zod';
import { PostUnpostedFinancialEventsSchema } from '../../schemas/commands';

export class PostUnpostedFinancialEventsDto extends createZodDto(
  PostUnpostedFinancialEventsSchema
) {}
