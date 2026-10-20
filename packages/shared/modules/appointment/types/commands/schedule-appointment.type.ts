import { ScheduleAppointmentSchema } from '../../schemas/command';
import { z } from 'zod';

export type ScheduleAppointment = z.infer<typeof ScheduleAppointmentSchema>;

/**
 * Form tarafının çalıştığı **giriş** tipi. `startTime` şemada `z.coerce.date()`
 * olduğu için çıkış `Date`, giriş `unknown`tur: `<input type="datetime-local">`
 * string üretir, dönüşümü Zod yapar. react-hook-form'u çıkış tipiyle
 * tiplemek "string atanamaz" hatası verir; doğru kalıp giriş + çıkışı ayrı
 * vermektir (`useForm<Input, unknown, Output>`).
 */
export type ScheduleAppointmentInput = z.input<typeof ScheduleAppointmentSchema>;
