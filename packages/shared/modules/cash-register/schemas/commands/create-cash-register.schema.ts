import { z } from 'zod';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';

/** Yeni kasa oluşturma. */
export const CreateCashRegisterSchema = z.object({
  name: z.string().min(1),
  currency: CurrencySchema.optional(),
  clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),
  // `organizationId` DTO'da YOK: kiracı kimliği istemciden alınmaz, `clinicId`
  // üzerinden çözülür (bkz. CLAUDE.md "TENANT_SCOPE_RESOLVER").
});
