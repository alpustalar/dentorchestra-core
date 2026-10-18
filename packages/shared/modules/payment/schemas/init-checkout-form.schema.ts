import { z } from 'zod';

export const InitCheckoutFormSchema = z.object({
  appointmentId: z
    .uuid({ message: 'Geçersiz randevu ID formatı' })
    .optional(),

  clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),

  patientId: z.uuid({ message: 'Geçersiz hasta ID formatı' }),

  /** TRY cinsinden tutar, örn: 500.00 */
  amount: z
    .number({ message: 'Tutar sayısal bir değer olmalıdır' })
    .positive({ message: 'Tutar sıfırdan büyük olmalıdır' })
    // Sanal POS'a giden tutar ile kayda geçen tutarın ayrışmaması için kuruş sınırı.
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    }),

  patientName: z
    .string()
    .min(2, { message: 'Hasta adı en az 2 karakter olmalıdır' })
    .max(100, { message: 'Hasta adı en fazla 100 karakter olabilir' }),

  patientPhone: z
    .string()
    .min(7, { message: 'Telefon numarası çok kısa' })
    .max(20, { message: 'Telefon numarası çok uzun' }),

  patientEmail: z
    .email({ message: 'Geçersiz e-posta formatı' })
    .optional(),

  treatmentName: z
    .string()
    .max(200, { message: 'Tedavi adı en fazla 200 karakter olabilir' })
    .optional(),

  clinicCity: z
    .string()
    .max(50, { message: 'Şehir adı en fazla 50 karakter olabilir' })
    .optional(),

  clinicAddress: z
    .string()
    .max(500, { message: 'Adres en fazla 500 karakter olabilir' })
    .optional(),
});
