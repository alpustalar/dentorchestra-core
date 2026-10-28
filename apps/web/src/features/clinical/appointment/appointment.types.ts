import type { Appointment } from '@dentorchestra/shared/client';

/**
 * Enum tipi modelin kendisinden türetilir (Lead diliminde olduğu gibi):
 * `generated-zod` derin import'una gerek kalmaz ve alan tipi modelde değişirse
 * burası kendiliğinden takip eder.
 */
export type AppointmentStatus = Appointment['status'];
