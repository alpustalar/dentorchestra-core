import { z } from 'zod';
import { SetClinicBusinessTypeSchema } from '../schemas/set-clinic-business-type.schema';

export type SetClinicBusinessType = z.infer<typeof SetClinicBusinessTypeSchema>;
