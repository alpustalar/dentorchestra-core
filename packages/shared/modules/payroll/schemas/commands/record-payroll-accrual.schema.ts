import { z } from 'zod';
import { FirebaseUidSchema } from '@shared/common/schemas';

/**
 * Bordro tahakkuku — hesaplanmış (brüt→net) rakamlar dışarıdan gelir; finans yalnız
 * tahakkuk fişini üretir (doc 05 §2.9). Denge özdeşliği:
 * grossSalary + employerSgk = netPayable + taxWithholding + (employeeSgk + employerSgk).
 */

/**
 * Tutarlar kuruş hassasiyetinde olmak zorunda: döküm `toFixed(2)` ile
 * yazıldığı için üçüncü basamak sessizce yuvarlanır ve denge özdeşliği
 * (brüt = net + stopaj + işçi SGK) yuvarlama sonrası bozulabilir — yevmiye
 * fişi o zaman "dengesiz" diyerek sebebinden kopuk bir yerde patlar.
 */
const PayrollAmountSchema = z.number().nonnegative().multipleOf(0.01, {
  message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
});

export const RecordPayrollAccrualSchema = z.object({
  employeeUserId: FirebaseUidSchema,
  /** Tahakkuk tarihi; muhasebe dönemini ve dedupe ay anahtarını belirler. */
  accrualDate: z.coerce.date(),
  grossSalary: PayrollAmountSchema, // brüt ücret
  employerSgk: PayrollAmountSchema, // işveren SGK payı
  netPayable: PayrollAmountSchema, // personele net ödenecek
  taxWithholding: PayrollAmountSchema, // GV stopajı + damga
  employeeSgk: PayrollAmountSchema, // işçi SGK kesintisi
  /**
   * Kiracı kimliği istemciden alınmaz: `organizationId` kaldırıldı,
   * `TENANT_SCOPE_RESOLVER` onu `clinicId`'den çözer (CLAUDE.md — kiracı
   * kapsamı çözümlemesi).
   */
  clinicId: z.uuid(),
});
