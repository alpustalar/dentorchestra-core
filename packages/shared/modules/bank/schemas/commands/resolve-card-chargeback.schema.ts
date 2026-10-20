import { z } from 'zod';
import { ChargebackFundsChannelEnum } from './open-card-chargeback.schema';

/**
 * Kart itirazının sonuçlandırılması.
 *
 *  - `WON`  → sağlayıcı kesilen parayı geri verdi (`B 108|102 / A 127`); paranın
 *             **nereye döndüğü** zorunludur.
 *  - `LOST` → kesinleşti (`B 120 / A 127`); hasta borcu yeniden doğar, taksit
 *             `CHARGED_BACK` olur ve aynı tutarda bir telafi taksidi açılır.
 *
 * Çözüm tek seferliktir: ikinci bir çözüm (kazanılanı kaybedilene çevirmek gibi)
 * kabul edilmez — o, ayrı bir ekonomik olay (itirazın yeniden açılması) olurdu.
 */
export const CardChargebackOutcomeEnum = z.enum(['WON', 'LOST']);

export const ResolveCardChargebackSchema = z
  .object({
    outcome: CardChargebackOutcomeEnum,
    /** Sonucun belli olduğu gün — çözüm fişinin belge tarihi. */
    resolvedAt: z.coerce.date(),
    /** Yalnız `WON`: kazanılan para nereye döndü. */
    fundsChannel: ChargebackFundsChannelEnum.optional(),
    /** Para bankaya döndüyse hangi hesap (opsiyonel; verilirse kiracısı doğrulanır). */
    bankAccountId: z.uuid().nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === 'WON' && data.fundsChannel === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fundsChannel'],
        message: 'Kazanılan itirazda paranın döndüğü kanal zorunludur.',
      });
    }
    if (data.outcome === 'LOST' && data.fundsChannel !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fundsChannel'],
        message: 'Kaybedilen itirazda para dönmez; kanal belirtilemez.',
      });
    }
  });
