import { SubscriptionCharge } from '@modules/platform/subscription/domain/entities/subscription-charge.entity';

export const SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY = Symbol(
  'ISubscriptionChargeCommandRepository'
);

export interface ISubscriptionChargeCommandRepository {
  /**
   * Dönemi tahsil etmek üzere sahiplenir (claim-then-charge).
   *
   * Dönüş `null` ise **aynı dönem için satır zaten var** — `(subscriptionId,
   * periodStart)` tekillik kısıtı tuttu. Bu, iki zamanlanmış çalıştırmanın aynı
   * aboneliği aynı anda işlemesinin DB tarafındaki cevabıdır: ikincisi para
   * çekmez. Çağıran mevcut satırı okuyup durumuna göre karar verir.
   */
  claim(charge: SubscriptionCharge): Promise<SubscriptionCharge | null>;

  /** Dönemin tahsilat satırı — claim başarısız olduğunda durumu okumak için. */
  findByPeriod(
    subscriptionId: string,
    periodStart: Date
  ): Promise<SubscriptionCharge | null>;

  /**
   * Satırı `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   * Sonuç yazma kararını beslediği için (aynı satıra iki sonuç yazılamaz)
   * kilitsiz okunmaz.
   */
  findByIdForUpdate(id: string): Promise<SubscriptionCharge | null>;

  update(charge: SubscriptionCharge): Promise<SubscriptionCharge>;

  /**
   * Sonucu yazılamamış (PENDING kalmış) ve belirtilen süreden eski satırlar.
   *
   * Bunlar "başarısız" DEĞİL, **"çekim yapıldı mı bilinmiyor"** satırlarıdır:
   * para çekildikten sonra transaction geri alınmış olabilir. Otomatik yeniden
   * denenmez; sağlayıcı mutabakatı için raporlanır.
   */
  findUnresolved(olderThan: Date): Promise<SubscriptionCharge[]>;
}
