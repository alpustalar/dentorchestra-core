import { GetClinicAppointmentsSchema } from '../../schemas/queries';
import { z } from 'zod';

export type GetClinicAppointments = z.infer<typeof GetClinicAppointmentsSchema>;
