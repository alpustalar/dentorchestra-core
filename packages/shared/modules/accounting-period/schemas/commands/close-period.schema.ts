import { z } from 'zod';
import { GrniAccrualSelectionListSchema } from './grni-accrual-selection.schema';

/**
 * Dönemi kapatma. Kapanış **geri alınamaz** (CLOSED'dan dönüş yok) ve fişleri önizlemeden
 * önce görmeden çalıştırılamaz: iki alan da zorunludur.
 *
 * `expectedLastEntryNo`: önizlemenin döndürdüğü yevmiye sayacı. Önizleme ile kapanış arasında
 * defterine yeni fiş girdiyse sayaç ilerler ve kapanış reddedilir — muhasebeci görmediği
 * tutarlarla kapanmaz. Sayaç `bigint` olduğundan string taşınır.
 *
 * `grniAccruals`: boş liste "bilerek tahakkuk yapılmadı" demektir; alan yok sayılmaz (zorunlu).
 */
export const ClosePeriodSchema = z.object({
  expectedLastEntryNo: z.string().regex(/^\d{1,18}$/, {
    message: 'expectedLastEntryNo önizlemenin döndürdüğü sayaç olmalıdır.',
  }),
  grniAccruals: GrniAccrualSelectionListSchema,
});
