import { Decimal } from 'decimal.js';

export const PAYMENT_COLLECTION_SERVICE = Symbol('IPaymentCollectionService');

export interface LockCollectedAmountParams {
  installmentId: string;
}

/**
 * Sanal POS taksit tahsilatının **geri götürülebilir** tutarını kilit altında okur.
 *
 * Fiziksel POS'un karşılığı: `POS_CARD_COLLECTION_SERVICE`. Kart sahibine parayı
 * geri götüren iki yol (iade, kart itirazı) aynı taksidin aynı tutarına dokunur;
 * ikisi de ödeme satırını `FOR UPDATE` ile kilitleyip aynı tavana bakmalıdır.
 *
 * Neden domain servisi (bus değil): kilitli skaler okumadır (CLAUDE.md
 * `lockAndGet*` istisnası). Kilit ile okuma tek metotta tutulur — ayrı iki metot
 * olsaydı çağrı sırası derleyiciye görünmez olurdu. Yetki kontrolü çağıranın işidir.
 *
 * Yalnız aktif bir transaction içinde çağrılır.
 */
export interface IPaymentCollectionService {
  /**
   * Taksidin ödemesini kilitler ve tahsil edilmiş tutarı döner.
   *
   * Reddeder: taksit yoksa ya da `COMPLETED` değilse (iade edilmiş, ters ibraz
   * edilmiş ya da hiç tahsil edilmemiş taksidin geri götürülecek parası yoktur).
   * Dönüş, aktif itirazları DÜŞMEZ; onları düşmek çağıranın (bank modülü) işidir.
   */
  lockAndGetCollectedAmount(params: LockCollectedAmountParams): Promise<Decimal>;
}
