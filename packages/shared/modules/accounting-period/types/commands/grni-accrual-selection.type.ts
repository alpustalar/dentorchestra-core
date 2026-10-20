import { z } from 'zod';
import { GrniAccrualSelectionSchema } from '../../schemas/commands';

export type GrniAccrualSelection = z.infer<typeof GrniAccrualSelectionSchema>;
