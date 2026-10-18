import { BookAppointmentSchema } from '@shared/modules';
import { z } from 'zod';

export type BookAppointment = z.infer<typeof BookAppointmentSchema>;
