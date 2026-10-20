import { z } from 'zod';
import { BusinessTypeSchema } from '@shared/generated-zod';

/**
 * Kliniğin işletme biçimi (şirket / şahıs). clinicId gövdede değil, path'ten gelir.
 * Kapanmış mali yılı olan klinikte DEĞİŞTİRİLEMEZ (ilk seçim her zaman serbest).
 */
export const SetClinicBusinessTypeSchema = z.object({
  businessType: BusinessTypeSchema,
});
