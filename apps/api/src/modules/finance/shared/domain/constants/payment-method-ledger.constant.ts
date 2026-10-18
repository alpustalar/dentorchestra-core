import {
  INBOUND_PAYMENT_METHODS,
  OUTBOUND_PAYMENT_METHODS,
} from '@shared/common/constants';
import type { PaymentMethodCode } from '@shared/common/constants';
import { ACCOUNTING_RULES } from './accounting-rules.constant';

const { TARGET_ACCOUNTS } = ACCOUNTING_RULES;

/**
 * Ödeme yönteminin **hangi hazır değer hesabını** hareket ettirdiği — tek kaynak.
 *
 * Kabul kümesi `@shared/common/constants` içindeki yöntem listelerinden gelir
 * (yazma kapısı da oradan beslenir); burada o kümenin **defter karşılığı** durur.
 * İki taraf aynı sabitten okuduğu için "yazılabilen ama fişlenemeyen" ya da
 * daha kötüsü "yazılabilen ve YANLIŞ hesaba fişlenen" bir yöntem oluşamaz
 * (CLAUDE.md finans kuralı 12).
 */
export const FUNDS_ACCOUNT_BY_PAYMENT_METHOD: Record<
  PaymentMethodCode,
  string
> = {
  CASH: TARGET_ACCOUNTS.CASH_100,
  BANK_TRANSFER: TARGET_ACCOUNTS.BANKS_102,
  POS_CARD: TARGET_ACCOUNTS.POS_108,
};

export { INBOUND_PAYMENT_METHODS, OUTBOUND_PAYMENT_METHODS };

export type PaymentDirection = 'INBOUND' | 'OUTBOUND' | 'REFUND';

const ALLOWED_BY_DIRECTION: Record<
  PaymentDirection,
  readonly PaymentMethodCode[]
> = {
  INBOUND: INBOUND_PAYMENT_METHODS,
  OUTBOUND: OUTBOUND_PAYMENT_METHODS,
  /**
   * İade: para GERİ gider ama **geldiği enstrümandan** — kartla alınan kartla,
   * nakit alınan nakit iade edilir. Bu yüzden kabul kümesi `OUTBOUND` değil
   * `INBOUND`'dur; `OUTBOUND` bilinçli olarak kart taşımıyor (satıcıya kartla
   * ödeme yapılmaz) ve onu kullanmak her kart iadesini "eşlenmemiş yöntem"
   * diye reddederdi. Yön ayrı bir isim taşıyor ki çağrı yerinde niyet görünsün.
   */
  REFUND: INBOUND_PAYMENT_METHODS,
};

/**
 * Yöntemin hazır değer hesabını çözer; eşlemesi olmayan ya da o **yön** için
 * kabul edilmeyen yöntemde `null` döner (çağıran kural hata fırlatır —
 * `resolveStockCounterAccount` ile aynı sözleşme: sabit dosyası exception
 * bilmez).
 *
 * Varsayılan hesaba düşmek yasak: eski kural `CASH` dışındaki her şeyi 102
 * Bankalar'a yazıyordu. Fiş dengeli olduğu için "Σborç = Σalacak" kontrolü
 * tutuyor, hata hiçbir yerde görünmüyordu — ama 102'ye hiçbir banka ekstresiyle
 * eşleşmeyecek bir hareket düşüyor (mutabakatta kalıcı UNMATCHED) ve gerçek
 * hesabın (kasa/kart) bakiyesi eksik kalıyordu. `resolveStockCounterAccount`
 * ile aynı tercih: eşlemesi olmayan girdi sessizce yanlış hesaba değil, hataya
 * gider.
 */
export function resolvePaymentFundsAccount(
  method: string,
  direction: PaymentDirection
): string | null {
  const code = ALLOWED_BY_DIRECTION[direction].find(
    (candidate) => candidate === method
  );

  return code ? FUNDS_ACCOUNT_BY_PAYMENT_METHOD[code] : null;
}
