import { z } from 'zod';

export const MatchLeadToPatientSchema = z.object({
  patientId: z.uuid(),
});
