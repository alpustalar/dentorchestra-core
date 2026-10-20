import { MODULE_LABELS } from '../constants';

/**
 * Platform (SaaS işletmecisi) kapsamındaki yetki modülleri.
 *
 * Klinik yöneticisi çalışanına **herhangi bir** yetki verebilir; bu liste tek
 * istisnadır. İki grup vardır:
 *
 * 1. **SaaS işletmesi** — abonelik, plan, modül, ödeme yöntemi, yönetici talebi,
 *    outbox. Bunlar kiracının işine değil, platformun kendi işletmesine ait.
 *    Klinik sahibi kendi aboneliğini rolü üzerinden görebilir, ama bunu personele
 *    dağıtabilmesinin bir karşılığı yok.
 *
 * 2. **Yetkilendirme tesisatı** — role, rolecapability, capability, usercapability.
 *    Bunlar dağıtılabilir olsaydı yetki sistemi kendi kendini yeniden yazabilirdi:
 *    `role:update` verilen bir personel, tüm kiracıların paylaştığı global rolleri
 *    değiştirebilirdi (Role tablosunda kiracı kolonu yok).
 *
 * Kiracıya ait olduğu için BİLEREK dışarıda bırakılanlar: `auditlog` (klinik kendi
 * kayıtlarını denetler) ve `staffnotification` (her personelin tabanında var).
 * Bunların suistimali, aktörün kendisinde olmayan yetkiyi verememesi kuralıyla
 * zaten kapalı.
 */
export const PLATFORM_CAPABILITY_MODULES = [
  // SaaS işletmesi
  'subscription',
  'subscriptionitem',
  'subscriptionpaymentmethod',
  'plan',
  'planmodule',
  'module',
  'adminrequest',
  'outbox',
  // Yetkilendirme tesisatı
  'role',
  'rolecapability',
  'capability',
  'usercapability',
] as const;

const PLATFORM_MODULE_SET: ReadonlySet<string> = new Set(
  PLATFORM_CAPABILITY_MODULES
);

/**
 * `module:action` biçimindeki bir yetkinin platform kapsamında olup olmadığı.
 * Biçimi tanınmayan girdi platform sayılır — bilinmeyen bir yetki dağıtılmaktansa
 * reddedilmesi tercih edilir (fail-closed).
 */
export const isPlatformCapability = (capability: string): boolean => {
  const [module, action] = capability.split(':');
  if (!module || !action) return true;
  return PLATFORM_MODULE_SET.has(module.toLowerCase());
};

/**
 * Etiketi olmayan platform modülü — liste ile MODULE_LABELS'ın ayrışmasını yakalar
 * (ör. model yeniden adlandırıldığında liste sessizce etkisiz kalmasın).
 */
export const platformModulesWithoutLabel = PLATFORM_CAPABILITY_MODULES.filter(
  (module) => !(module in MODULE_LABELS)
);
