import { RenewalChargeModel } from '@modules/platform/subscription/domain/contracts';
import { Module as IModule } from '@shared';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const SUBSCRIPTION_COMMAND_REPOSITORY = Symbol(
  'ISubscriptionCommandRepository'
);

/** Abonelik sahibi — org her zaman, clinicId yalnız CLINIC hedefte (franchise). */
export interface SubscriptionOwnerRef {
  organizationId: string;
  clinicId: string | null;
}

export interface ISubscriptionCommandRepository extends IBaseCommandRepository<Subscription> {
  sync(subscription: Subscription): Promise<Subscription | null>;
  syncMany(subscriptions: Subscription[]): Promise<void>;
  /**
   * Aboneliği `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   * Para hareketi (yenileme tahsilatı) ve erişim kesme (expire) kararlarını besleyen
   * her okuma buradan yapılır; aksi halde iki zamanlanmış çalıştırma aynı aboneliği
   * görüp kartı iki kez çekebilir.
   */
  findByIdForUpdate(id: string): Promise<Subscription | null>;
  /** Sağlayıcı referansıyla kilitleyerek yükler (ödeme callback'i) — yalnız transaction içinde. */
  findByExternalIdForUpdate(externalId: string): Promise<Subscription | null>;
  /** Sahip (org veya klinik) için abonelik var mı — mükerrer abonelik/çift faturalama guard'ı. */
  existsByOwner(owner: SubscriptionOwnerRef): Promise<boolean>;
  /**
   * Deneme süresi (trialEndsAt) dolan abonelik ADAYLARI — trial-expiry processor.
   * Sonuç bir adaydır: her satır işlenmeden önce `findByIdForUpdate` ile kilitli
   * yeniden okunur, çünkü tarama ile işleme arasında müşteri ödeme yapmış olabilir.
   */
  findExpiredTrials(now: Date): Promise<Subscription[]>;
  /** Yenileme günü gelmiş abonelik ADAYLARI — renewal processor (yukarıdaki not geçerli). */
  findDueForRenewal(now: Date): Promise<Subscription[]>;
  /** PAST_DUE abonelik ADAYLARI — dunning/expire processor (yukarıdaki not geçerli). */
  findPastDue(): Promise<Subscription[]>;
  /** Aboneliğin aylık tahsilat tutarı (aktif kalemlerin toplamı) — çekilecek tutarı belirler. */
  findRenewalCharge(subscriptionId: string): Promise<RenewalChargeModel | null>;
  /**
   * Org'un aboneliği — modül ekleme gibi kalem/para yazan akışlarda hedef abonelik.
   * Yazma kararını beslediği için Command Context'te okunur.
   */
  findByOrganizationId(organizationId: string): Promise<Subscription | null>;
  /**
   * Modül kataloğu satırı — satın alınacak modülün fiyatı/aktifliği tahsilatı
   * belirler; bayat okuma yanlış tutar çekmeye yol açar.
   */
  findModuleByKey(key: string): Promise<IModule | null>;
}
