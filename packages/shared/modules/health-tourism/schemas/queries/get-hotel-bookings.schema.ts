import { z } from 'zod';
import { PaginationSchema } from '@shared/common/pagination/pagination.schema';

export const GetHotelBookingsSchema = z.object({
  pagination: PaginationSchema,
  patientId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  clinicId: z.uuid(),
});
