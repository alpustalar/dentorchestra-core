import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { SubscriptionPaymentMethod } from '@modules/platform/subscription/domain/entities/subscription-payment-method.entity';
import {
  CreateSubscriptionPaymentMethodProps,
  SavedCardChargeModel,
} from '@modules/platform/subscription/domain/contracts';

export const SUBSCRIPTION_PAYMENT_METHOD_COMMAND_REPOSITORY = Symbol(
  'ISubscriptionPaymentMethodCommandRepository'
);

/**
 * NOT: Bu aggregate'in Query repository'si YOK — kayıtlı kart yalnız yenileme
 * tahsilatının içinden okunuyor; maskeli kart bilgisini UI'a göstermek gerekirse
 * ayrı bir read-model query'si açılır, bu repo yazma tarafında kalır.
 */

export interface ISubscriptionPaymentMethodCommandRepository extends IBaseCommandRepository<SubscriptionPaymentMethod> {
  create(entity: SubscriptionPaymentMethod): Promise<SubscriptionPaymentMethod>;
  /**
   * Abonelik-başına tek kayıtlı yöntem: varsa günceller (yeni kart), yoksa oluşturur.
   * Kart değişimi/yeniden saklama akışında callback'ten çağrılır.
   */

  upsertBySubscriptionId(
    props: CreateSubscriptionPaymentMethodProps
  ): Promise<SubscriptionPaymentMethod>;
  /**
   * Yenileme günü tahsilat için kayıtlı kart + alıcı snapshot'ı — yoksa null.
   *
   * Command repo'da: hangi kartın çekileceğini belirliyor. Müşteri kartını az önce
   * değiştirdiyse replica'dan okumak eski token'la çekim denemesine yol açardı.
   */
  findBySubscriptionId(
    subscriptionId: string
  ): Promise<SavedCardChargeModel | null>;
}
