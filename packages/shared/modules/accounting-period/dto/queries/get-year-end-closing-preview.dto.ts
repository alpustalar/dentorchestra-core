import { createZodDto } from 'nestjs-zod';
import { GetYearEndClosingPreviewSchema } from '../../schemas/queries';

export class GetYearEndClosingPreviewFilterDto extends createZodDto(
  GetYearEndClosingPreviewSchema
) {}
