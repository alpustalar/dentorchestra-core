import { z } from 'zod';
import { GetYearEndClosingPreviewSchema } from '../../schemas/queries';

export type GetYearEndClosingPreview = z.infer<
  typeof GetYearEndClosingPreviewSchema
>;
