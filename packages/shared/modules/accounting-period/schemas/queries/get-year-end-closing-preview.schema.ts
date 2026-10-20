import { z } from 'zod';
import { GrniAccrualSelectionListSchema } from '../commands/grni-accrual-selection.schema';

/**
 * Yıl sonu kapanış önizlemesi. Okuma işlemidir ama seçimi (tahakkuk edilecek siparişler)
 * gövdede taşır: seçim listesi sorgu dizesine sığmayacak kadar yapılandırılmış olduğundan
 * `POST` kullanılır; **hiçbir şey yazmaz**.
 */
export const GetYearEndClosingPreviewSchema = z.object({
  grniAccruals: GrniAccrualSelectionListSchema.default([]),
});
