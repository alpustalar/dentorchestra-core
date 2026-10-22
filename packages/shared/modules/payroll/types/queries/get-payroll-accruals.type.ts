import { z } from 'zod';
import { GetPayrollAccrualsSchema } from '../../schemas/queries';

export type GetPayrollAccruals = z.infer<typeof GetPayrollAccrualsSchema>;
