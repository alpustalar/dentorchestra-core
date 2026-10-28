'use client';

import type { ActorContextResponse } from '@dentorchestra/shared/client';

import { useAuth } from './auth-provider';

/**
 * Backend'in `CapabilityGuard`ının **birebir aynası**. İki ayrıntı kasıtlı:
 *
 * 1. `rolePriority >= 100` her kontrolü atlar (guard'da da öyle) — süper
 *    kullanıcıya yetkinlik listesi bakılmadan izin verilir.
 * 2. Eşleşme `includes`, tam eşitlik değil. Guard böyle yazılmış; burada
 *    eşitliğe çevirseydik frontend backend'den **daha katı** olur ve kullanıcı
 *    aslında yapabildiği bir işlemin butonunu göremezdi.
 *
 * Bu yalnız görünürlük kararıdır. Yetkinin otoritesi her zaman backend'dir —
 * burada `true` dönmek işlemin geçeceği anlamına gelmez.
 */
export function actorHasCapability(
  actor: ActorContextResponse | null,
  capability: string
): boolean {
  if (!actor) return false;
  if (actor.rolePriority >= 100) return true;

  return actor.capabilities.some((granted) =>
    granted.toLowerCase().includes(capability.toLowerCase())
  );
}

/** `useCapability('lead:create')` */
export function useCapability(capability: string): boolean {
  const { actor } = useAuth();
  return actorHasCapability(actor, capability);
}

export function useAnyCapability(capabilities: string[]): boolean {
  const { actor } = useAuth();
  return capabilities.some((capability) =>
    actorHasCapability(actor, capability)
  );
}
