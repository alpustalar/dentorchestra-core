import { z } from 'zod';
import { FirebaseUidSchema } from '@shared/common/schemas';

/**
 * Bordro tahakkuk geçmişi filtresi. `clinicId` ayrı `@Query` parametresi olarak
 * gelir (financial-events ile aynı desen). Altyapı (financial_events) yalnız
 * `sourceRefId` EŞİTLİĞİNİ bilir — kısmi filtre (sadece employeeUserId ya da
 * sadece monthKey) desteklenmez; bu yüzden ikisi birlikte ya da hiç verilir.
 */
export const GetPayrollAccrualsSchema = z
  .object({
    employeeUserId: FirebaseUidSchema.optional(),
    monthKey: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Ay YYYY-MM biçiminde olmalı')
      .optional(),
  })
  .refine((v) => Boolean(v.employeeUserId) === Boolean(v.monthKey), {
    message: 'employeeUserId ve monthKey birlikte verilmeli.',
    path: ['monthKey'],
  });
