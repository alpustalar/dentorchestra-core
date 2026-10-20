import { z } from 'zod';

export const BusinessTypeSchema = z.enum(['COMPANY','SOLE_PROPRIETOR']);

export type BusinessTypeType = `${z.infer<typeof BusinessTypeSchema>}`

export default BusinessTypeSchema;
