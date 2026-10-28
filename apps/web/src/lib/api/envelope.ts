import type { PaginationMeta } from '@dentorchestra/shared/client';

/**
 * Backend üç ayrı şekil döndürüyor — hepsi normalize edilip tek tipe indirilir.
 *
 * 1. `QueryResponse<T>`  → `{ data, meta? }`                       (query handler'ları)
 * 2. Serileştirilmiş     → `{ data, meta?, serialization }`        (`@Serialize` uygulanmışsa)
 * 3. Sarmalanmamış       → değerin kendisi                          (command'ler: `string` id / `void`)
 *
 * Üçüncüsü sürpriz gibi görünebilir ama CLAUDE.md'nin kuralı: command'ler zengin
 * model döndürmez, `create` doğrudan `id` döner. Controller onu `QueryResponse`'a
 * sarmadığı için gövde çıplak bir string olur.
 */
export interface ApiResult<T> {
  data: T;
  pagination?: PaginationMeta;
  /**
   * Policy'nin bu cevap için açtığı serileştirme grupları. Backend görmemesi
   * gereken alanları zaten **silerek** gönderiyor; frontend buna bakarak o
   * alanın kolonunu/inputunu hiç render etmez ("undefined" gösteren kırık UI olmaz).
   */
  groups?: string[];
}

type EnvelopeShape = {
  data: unknown;
  meta?: {
    pagination?: PaginationMeta;
    serializationOptions?: { groups?: string[] };
    [key: string]: unknown;
  };
  serialization?: { groups?: string[] };
};

/**
 * Zarf mı, çıplak değer mi? `data` anahtarı taşıyan düz obje zarf sayılır.
 *
 * Kuramsal bir çakışma var: gerçek veri de `data` adlı bir alan taşıyabilir.
 * Pratikte backend'in hiçbir read-model'i böyle bir alan taşımıyor ve bu
 * belirsizliği tek bir yerde tutmak, her çağrı yerinde şekil kontrolü
 * yapmaktan iyi.
 */
function isEnvelope(payload: unknown): payload is EnvelopeShape {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'data' in payload
  );
}

export function normalizeEnvelope<T>(payload: unknown): ApiResult<T> {
  if (!isEnvelope(payload)) {
    return { data: payload as T };
  }

  return {
    data: payload.data as T,
    pagination: payload.meta?.pagination,
    /*
     * Gruplar iki ayrı yerde olabiliyor: `@Serialize` uygulanmış endpoint'lerde
     * interceptor onları sadeleştirip `serialization` altına taşıyor; uygulanmamış
     * olanlarda (ör. lead controller'ı) handler'ın koyduğu hâliyle
     * `meta.serializationOptions` altında kalıyor. İkisine de bakılmazsa
     * serileştirme uygulanmayan ekranlarda gruplar sessizce kaybolur.
     */
    groups:
      payload.serialization?.groups ??
      payload.meta?.serializationOptions?.groups,
  };
}
