import { z } from 'zod';
import PaymentMethodSchema from '../../../generated-zod/inputTypeSchemas/PaymentMethodSchema';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';

export const CreatePaymentSchema = z
  .object({
    clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),
    patientId: z.uuid({ message: 'Geçersiz hasta ID formatı' }),
    appointmentId: z
      .uuid({ message: 'Geçersiz randevu ID formatı' })
      .optional(),
    providerId: z.uuid({ message: 'Geçersiz sağlayıcı ID formatı' }).optional(),
    /**
     * Tahsilat tutarı. **Gönderilmezse** randevunun fiyatlı işlem satırlarından
     * (TreatmentCharge) türetilir — asıl kullanım budur; elle tutar yazmak
     * kapora/tedavi dışı tahsilat gibi satırsız senaryolar içindir.
     */
    amount: z
      .number({ message: 'Tutar sayısal bir değer olmalıdır' })
      .positive({ message: 'Tutar sıfırdan büyük olmalıdır' })
      // Kuruştan ince tutar DB'de (`Decimal(10,2)`) sessizce yuvarlanır; tahsil
      // edilen ile kayda geçen tutar birbirinden ayrışır.
      .multipleOf(0.01, { message: 'Tutar en fazla 2 ondalık basamak taşıyabilir' })
      .optional(),
    currency: CurrencySchema,
    method: PaymentMethodSchema.default('CREDIT_CARD').optional(),
    dueDate: z.coerce.date().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((data) => data.amount !== undefined || !!data.appointmentId, {
    message:
      'Tutar gönderilmediğinde, tutarın türetileceği randevu (appointmentId) zorunludur.',
    path: ['amount'],
  });
