import { Decimal } from 'decimal.js';

export const POS_CARD_COLLECTION_SERVICE = Symbol('IPosCardCollectionService');

export interface LockReversibleAmountParams {
  posTransactionId: string;
}

/**
 * Fiziksel POS satışının **geri götürülebilir** tutarını kilit altında okur.
 *
 * Kart sahibine parayı geri götüren iki yol vardır ve ikisi de aynı satışın
 * aynı tutarına dokunur: iade/iptal (bizim kararımız) ve kart itirazı (kart
 * sahibinin kararı). İkisi de bu satırı `FOR UPDATE` ile kilitleyip aynı
 * kümülatif tavana bakar; kilit yoksa iki eşzamanlı istek de "henüz geri
 * götürülmemiş" görür ve kart sahibine para iki kez gider.
 *
 * Neden domain servisi (bus değil): bu bir yazma kararını besleyen **kilitli
 * skaler okumadır** (CLAUDE.md `lockAndGet*` istisnası). Kilit ile okuma tek
 * metotta tutulur — ayrı iki metot olsaydı çağrı sırası derleyiciye görünmez
 * olur, tavan sessizce kilitsiz veriyle hesaplanırdı. Yetki kontrolü çağıran
 * handler'ın işidir; servis yetki değerlendirmez.
 *
 * Yalnız aktif bir transaction içinde çağrılır (kilit tx dışında etkisizdir).
 */
export interface IPosCardCollectionService {
  /**
   * Satışı kilitler ve `satış tutarı − canlı iadeler` döner.
   *
   * Reddeder: satış yoksa, satış değilse ya da başarılı değilse, canlı bir
   * iptali (VOID) varsa — iptal edilmiş satışta geri götürülecek tutar kalmaz.
   * Dönüş, aktif itirazları DÜŞMEZ; onları düşmek çağıranın (bank modülü) işidir.
   */
  lockAndGetReversibleAmount(
    params: LockReversibleAmountParams
  ): Promise<Decimal>;
}
