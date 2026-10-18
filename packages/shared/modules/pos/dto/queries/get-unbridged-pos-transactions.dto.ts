import { createZodDto } from 'nestjs-zod';
import { GetUnbridgedPosTransactionsSchema } from '../../schemas/queries';

export class GetUnbridgedPosTransactionsFilterDto extends createZodDto(
  GetUnbridgedPosTransactionsSchema
) {}
