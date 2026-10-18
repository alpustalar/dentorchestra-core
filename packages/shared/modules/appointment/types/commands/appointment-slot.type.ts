import { z } from 'zod';
import { AppointmentSlotSchema } from '@shared/modules';

export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;
