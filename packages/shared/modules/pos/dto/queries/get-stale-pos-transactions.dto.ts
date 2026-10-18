import { createZodDto } from 'nestjs-zod';
import { GetStalePosTransactionsSchema } from '../../schemas/queries';

export class GetStalePosTransactionsFilterDto extends createZodDto(
  GetStalePosTransactionsSchema
) {}
