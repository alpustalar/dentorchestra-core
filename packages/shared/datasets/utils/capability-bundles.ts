import { Capability, ModelCapabilities } from './capability-helper';
import { CrudAction } from '../constants';

type AnyCapability = Capability<CrudAction>;

const pick = (
  models: ModelCapabilities[],
  actions: CrudAction[]
): AnyCapability[] =>
  models.flatMap((model) =>
    actions.map((action) => model[action] as AnyCapability)
  );

/**
 * Yalnız görüntüleme. Rolün "haberdar olması gereken ama dokunmaması gereken"
 * alanları için (ör. muhasebecinin randevu listesini görmesi).
 */
export const readOnly = (...models: ModelCapabilities[]): AnyCapability[] =>
  pick(models, ['read']);

/**
 * Günlük operasyon: oluştur + görüntüle + güncelle. **Silme yoktur** —
 * kayıt silme yıkıcıdır ve bilinçli olarak yalnız `fullAccess` ile verilir.
 */
export const manage = (...models: ModelCapabilities[]): AnyCapability[] =>
  pick(models, ['create', 'read', 'update']);

/** Tüm CRUD — silme dahil. */
export const fullAccess = (...models: ModelCapabilities[]): AnyCapability[] =>
  pick(models, ['create', 'read', 'update', 'delete']);

/** Kayıt açma + görüntüleme (güncelleme/silme yok) — ör. personelin izin talebi. */
export const submitOnly = (...models: ModelCapabilities[]): AnyCapability[] =>
  pick(models, ['create', 'read']);

/**
 * Aynı yetkinin birden çok demette tekrarlanmasını temizler.
 * (Seed `capability.findUniqueOrThrow` ile tek tek çözdüğü için tekrar zararsızdır
 * ama gereksiz sorgu üretir; ayrıca rol tanımını okurken kafa karıştırır.)
 */
export const uniqueCapabilities = (
  capabilities: AnyCapability[]
): AnyCapability[] => {
  const seen = new Set<string>();

  return capabilities.filter((capability) => {
    const key = `${capability.module}:${capability.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
