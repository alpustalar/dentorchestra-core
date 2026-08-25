import { z } from 'zod';
import { PaginationSchema } from '@shared/common/pagination/pagination.schema';

export const GetFlightBookingsSchema = z.object({
  clinicId: z.uuid(),
  organizationId: z.uuid().optional().nullable(),
  patientId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  pagination: PaginationSchema,
});
