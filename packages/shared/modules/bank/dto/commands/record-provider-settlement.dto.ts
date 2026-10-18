import { createZodDto } from 'nestjs-zod';
import { RecordProviderSettlementSchema } from '../../schemas/commands';

export class RecordProviderSettlementDto extends createZodDto(
  RecordProviderSettlementSchema
) {}
