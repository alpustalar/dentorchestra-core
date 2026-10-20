import { z } from 'zod';

export const AppointmentEmbeddingScalarFieldEnumSchema = z.enum(['id','appointmentId','clinicId','contentChunk','createdAt','updatedAt']);

export default AppointmentEmbeddingScalarFieldEnumSchema;
