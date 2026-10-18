import { z } from 'zod';
import CashMovementTypeSchema from '@shared/generated-zod/inputTypeSchemas/CashMovementTypeSchema';

/**
 * Hareket olarak kaydedilebilen türler: `OPENING_FLOAT` **hariç**. Açılış nakdi
 * oturumun kendi kolonunda yaşar ve kapanışta beklenen tutara zaten dahildir;
 * bir de hareket olarak girilirse beklenen tutar iki kez şişer ve gerçek bir
 * kasa açığı "denk" görünür. Kapı, entity'deki invariant ile aynı kümeyi
 * kullanır (bkz. `CashOpeningFloatNotAMovementException`).
 */
export const RecordableCashMovementTypeSchema = CashMovementTypeSchema.exclude([
  'OPENING_FLOAT',
]);

/** Açık kasa oturumuna nakit giriş/çıkış hareketi. Yön, türden türetilir. */
export const RecordCashMovementSchema = z.object({
  type: RecordableCashMovementTypeSchema,
  amount: z
    .number()
    .positive()
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    }),
  description: z.string().nullable().optional(),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
});
