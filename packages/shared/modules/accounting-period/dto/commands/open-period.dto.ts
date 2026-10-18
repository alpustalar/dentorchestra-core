import { createZodDto } from 'nestjs-zod';
import { OpenPeriodSchema } from '../../schemas/commands';

export class OpenPeriodDto extends createZodDto(OpenPeriodSchema) {}
