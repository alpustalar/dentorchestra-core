import { z } from 'zod';

export const FindClinicsByOrganizationSchema = z.object({
  organizationId: z.uuid().optional(),
});
