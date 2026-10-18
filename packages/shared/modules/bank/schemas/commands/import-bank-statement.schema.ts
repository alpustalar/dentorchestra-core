import { z } from 'zod';

/**
 * Banka ekstresi import (API'siz). Frontend CSV'yi parse edip satırları JSON
 * olarak yollar; amount imzalıdır (+ giriş / − çıkış).
 */
export const ImportBankStatementSchema = z.object({
  bankAccountId: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  // Kuruş sınırı: DB kolonları `Decimal(16,2)`. Fazla hane sessizce yuvarlanır
  // ve ekstrenin kendi bakiye kontrolü (açılış + Σ = kapanış) yanlış yere düşer.
  openingBalance: z
    .number()
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    })
    .nullable()
    .optional(),
  closingBalance: z
    .number()
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    })
    .nullable()
    .optional(),
  fileName: z.string().nullable().optional(),
  lines: z
    .array(
      z.object({
        transactionDate: z.coerce.date(),
        description: z.string().min(1),
        // İmzalı tutar (+ giriş / − çıkış); kuruştan ince olamaz.
        amount: z
          .number()
          .multipleOf(0.01, {
            message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
          }),
        balanceAfter: z
          .number()
          .multipleOf(0.01, {
            message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
          })
          .nullable()
          .optional(),
        reference: z.string().nullable().optional(),
        counterpartyName: z.string().nullable().optional(),
      })
    )
    .min(1),
});
