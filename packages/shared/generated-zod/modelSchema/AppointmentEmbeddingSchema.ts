import { z } from 'zod';

/////////////////////////////////////////
// APPOINTMENT EMBEDDING SCHEMA
/////////////////////////////////////////

export const AppointmentEmbeddingSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  clinicId: z.string(),
  contentChunk: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type AppointmentEmbedding = z.infer<typeof AppointmentEmbeddingSchema>

export default AppointmentEmbeddingSchema;
