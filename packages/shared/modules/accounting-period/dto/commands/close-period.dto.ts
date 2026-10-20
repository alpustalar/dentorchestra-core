import { createZodDto } from 'nestjs-zod';
import { ClosePeriodSchema } from '../../schemas/commands';

export class ClosePeriodDto extends createZodDto(ClosePeriodSchema) {}
