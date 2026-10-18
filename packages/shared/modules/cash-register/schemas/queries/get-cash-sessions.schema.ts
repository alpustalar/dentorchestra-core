import { z } from 'zod';
import CashSessionStatusSchema from '@shared/generated-zod/inputTypeSchemas/CashSessionStatusSchema';

export const GetCashSessionsSchema = z.object({
  cashRegisterId: z.uuid().optional(),
  status: CashSessionStatusSchema.optional(),
  /**
   * Yalnız sayım farkı olan (fazla/açık) kapanışlar. Kasa farkı ayrı bir onay
   * akışına bağlı değil (bkz. §25 ertelenenler); farkın görülebildiği tek yer
   * bu listedir — fark kapanışta deftere (689/679) yazıldığı için denetimsiz
   * kalmamalıdır.
   */
  hasDifference: z.coerce.boolean().optional(),
});
