import { z } from 'zod';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';
import { OUTBOUND_PAYMENT_METHODS } from '@shared/common/constants';

/**
 * Satıcıya yapılan ödeme — 320'deki cari borcu kapatır.
 *
 * Ayrı bir tablo tutulmaz: kalıcı kayıt `FinancialEvent`'in kendisidir
 * (append-only olay defteri). `reference` havale/dekont numarasıdır ve hem fiş
 * açıklamasına hem idempotency anahtarına girer.
 */
export const RecordSupplierPaymentSchema = z.object({
  clinicId: z.uuid(),
  /** Satıcı carisi (320 `requiresParty`). */
  partyId: z.uuid(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Tutar 0.00 biçiminde olmalı')
    // Sıfır tutarlı ödeme hiçbir borcu kapatmaz; üstelik fiş satırı muhasebe
    // kuralınca (borç ve alacak birlikte sıfır olamaz) üretilemediği için olay
    // defterde sonsuza dek fişsiz kalırdı.
    .refine((v) => Number(v) > 0, 'Tutar sıfırdan büyük olmalı'),
  currency: CurrencySchema.optional(),
  /**
   * Kabul kümesi tek kaynaktan (`OUTBOUND_PAYMENT_METHODS`): kopya liste,
   * posting tarafındaki hesap eşlemesiyle sessizce ayrışabilirdi — kapı
   * kullanım yerinden geniş olamaz (CLAUDE.md finans kuralı 12).
   */
  method: z.enum(OUTBOUND_PAYMENT_METHODS),
  /** Ödeme tarihi; verilmezse şimdi. İleri tarihli ödeme kaydedilemez. */
  paidAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 5 * 60_000, {
      message: 'Ödeme tarihi gelecekte olamaz.',
    })
    .optional(),
  /** Havale/dekont referansı — aynı referans ikinci kez yazılmaz. */
  reference: z.string().min(1).max(120).optional(),
});
