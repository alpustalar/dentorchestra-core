import { z } from 'zod';
import { AppointmentSlotSchema } from '../../schemas/command';

export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;
