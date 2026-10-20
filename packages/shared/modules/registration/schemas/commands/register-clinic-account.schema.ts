import { z } from 'zod';
import { BusinessTypeSchema } from '@shared/generated-zod';
import { CreateClinicSchema } from '@shared/modules/clinic/schemas';
import { RegisterUserOrProviderAccountSchema } from '@shared/modules/user/schemas/commands';

export const RegisterClinicAccountSchema = z.object({
  /** İşletme biçimi (şirket / şahıs): yıl sonu devrinin hedefini belirler; kayıtta zorunlu. */
  businessType: BusinessTypeSchema,
  clinic: CreateClinicSchema.omit({ organizationId: true }),
  owner: RegisterUserOrProviderAccountSchema.omit({ roleId: true, organizationId: true, clinicId: true, providerProfile: true }),
});
