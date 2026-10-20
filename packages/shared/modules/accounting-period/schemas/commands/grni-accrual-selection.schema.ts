import { z } from 'zod';
import { PURCHASE_INVOICE_LINE_ACCOUNT_CODES } from '@shared/common/constants';

/**
 * Yıl sonu GRNI tahakkuku için muhasebecinin **seçimi**: hangi sipariş tahakkuk
 * edilsin ve borç hangi hesaba yazılsın.
 *
 * **Tutar yoktur — bilerek.** Tahakkuk tutarı (31 Aralık itibarıyla teslim alınan − faturalanan)
 * sunucuda mal kabul günlüğünden ve alış faturalarından hesaplanır; istemciden gelen bir
 * tutar yıl sonu kapanışında deftere para yazdırmanın yolu olurdu. İstemci yalnız *neyin*
 * tahakkuk edileceğine karar verir.
 *
 * Borç hesabı alış faturasının karşı hesap kümesinden gelir (`PURCHASE_INVOICE_LINE_ACCOUNT_CODES`):
 * tahakkuk, fatura geldiğinde borçlanacak hesabın aynısını önceden borçlandırır (CLAUDE.md
 * finans kuralı 12). `329` bu kümede değildir — karşı hesabın kendisi borç hesabı olamaz.
 */
export const GrniAccrualSelectionSchema = z.object({
  orderId: z.uuid(),
  debitAccountCode: z.enum(PURCHASE_INVOICE_LINE_ACCOUNT_CODES),
});

/** Aynı sipariş iki kez seçilemez: iki tahakkuk satırı aynı malı iki kez borçlandırırdı. */
export const GrniAccrualSelectionListSchema = z
  .array(GrniAccrualSelectionSchema)
  .max(200)
  .refine(
    (list) => new Set(list.map((item) => item.orderId)).size === list.length,
    { message: 'Aynı sipariş birden fazla kez seçilemez.' }
  );
