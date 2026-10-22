import { z } from 'zod';
import { FindClinicsByOrganizationSchema } from '../schemas';

export type FindClinicsByOrganization = z.infer<
  typeof FindClinicsByOrganizationSchema
>;
