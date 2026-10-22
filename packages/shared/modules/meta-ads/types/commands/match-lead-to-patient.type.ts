import { z } from 'zod';
import { MatchLeadToPatientSchema } from '../../schemas/commands';

export type MatchLeadToPatient = z.infer<typeof MatchLeadToPatientSchema>;
