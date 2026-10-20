import { BookAppointmentSchema } from '../../schemas/command';
import { z } from 'zod';

export type BookAppointment = z.infer<typeof BookAppointmentSchema>;
