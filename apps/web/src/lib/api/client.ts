import type {
  AnyEndpoint,
  BodyOf,
  PaginationInput,
  ParamsOf,
  QueryOf,
  ResponseOf,
} from '@core-crm/shared/client';
import { ApiError, toApiError } from './error';
import { type ApiResult, normalizeEnvelope } from './envelope';
import { getTokenProvider } from './token-provider';

/**
 * Sürümleme öneki dahil taban adres (`.../api/v1`). Sunucu bileşenlerinden de
 * çağrıldığı için **mutlak** olmalı: Node'un `fetch`'i göreli yolu çözemez.
 */
const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'
).replace(/\/$/, '');

/**
 * Messaging ayrı bir serviste (:8081) yaşıyor ama dışarıya **tek origin** olarak
 * görünür: ters vekil `/api/v1/messaging/*` isteklerini oraya, kalanını api'ye
 * yönlendirir (`infra/nginx/core-crm.conf`). Üretimde bu değişken boş bırakılır ve
 * her şey tek adresten gider.
 *
 * Yerel geliştirmede vekil varsayılan olarak kapalı (`--profile proxy`), servislere
 * doğrudan gidiliyor. O yüzden bu değişken verilirse `/messaging` önekli yollar
 * doğrudan messaging'e gönderilir. Verilmezse davranış değişmez — yani vekil
 * kurulumunda bu kod yolu hiç devreye girmez.
 */
const MESSAGING_BASE_URL = process.env.NEXT_PUBLIC_MESSAGING_API_URL?.replace(
  /\/$/,
  ''
);

/** Ters vekilin de baktığı önek; tek kaynakta dursun diye sabit. */
const MESSAGING_PATH_PREFIX = '/messaging/';

/**
 * `AuthGuard` bu başlığı okuyup `actor.source`a yazıyor; audit log'un "bu işlem
 * nereden geldi" sorusunun cevabı bu. Gönderilmezse SYSTEM'e düşer.
 * (Backend'deki `LogSource` enum'ı nest-kernel'de yaşıyor ve `shared`'a açık
 * değil — o yüzden burada sabit.)
 */
const SOURCE_TYPE = 'WEB';

interface BaseRequestOptions {
  /** Sunucu tarafında zorunlu: cookie'den okunan Firebase ID token. */
  token?: string;
  signal?: AbortSignal;
  /**
   * Sayfalama birinci sınıf bir seçenek, endpoint şemasının parçası değil —
   * çünkü backend de öyle: controller `@Query() dto` (filtre) ve
   * `@Query() pagination` (PaginationDto) olarak **iki ayrı** DTO alıyor, ikisi
   * de aynı sorgu dizesinden çözülüyor. Şemaya gömseydik her liste endpoint'inde
   * aynı yedi alanı tekrar yazmak gerekirdi.
   */
  pagination?: PaginationInput;
}

/**
 * Endpoint sözleşmesinden türeyen istek seçenekleri. `params` / `body` yalnız
 * endpoint onları tanımlıyorsa **zorunlu**; tanımlamıyorsa geçilmesi derleme
 * hatası (`?: never`).
 */
export type RequestOptions<E> = BaseRequestOptions &
  ([ParamsOf<E>] extends [never]
    ? { params?: never }
    : { params: ParamsOf<E> }) &
  ([BodyOf<E>] extends [never] ? { body?: never } : { body: BodyOf<E> }) &
  ([QueryOf<E>] extends [never] ? { query?: never } : { query?: QueryOf<E> });

/**
 * Seçenek nesnesi yalnız gerçekten zorunlu bir alan varsa şart koşulur; aksi
 * hâlde `api(endpoint)` diye çağrılabilir. Bunun için rest-tuple hilesi gerekli:
 * parametreye varsayılan değer vermek onu her durumda opsiyonel yapar ve zorunlu
 * `params`ı sessizce kaçırırdı.
 */
type ApiArgs<E> = [ParamsOf<E>] extends [never]
  ? [BodyOf<E>] extends [never]
    ? [options?: RequestOptions<E>]
    : [options: RequestOptions<E>]
  : [options: RequestOptions<E>];

function appendSearchParams(url: URL, source: unknown): void {
  if (!source || typeof source !== 'object') return;

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;

    // Dizi filtreleri tekrarlı anahtar olarak gider (`?status=NEW&status=WON`) —
    // NestJS'in varsayılan sorgu ayrıştırıcısının beklediği biçim.
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      continue;
    }

    url.searchParams.append(
      key,
      value instanceof Date ? value.toISOString() : String(value)
    );
  }
}

function buildUrl(
  endpoint: Pick<AnyEndpoint, 'method' | 'path'>,
  params: unknown,
  query: unknown,
  pagination: PaginationInput | undefined
): string {
  const path =
    typeof endpoint.path === 'function'
      ? endpoint.path(params as never)
      : endpoint.path;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base =
    MESSAGING_BASE_URL && normalized.startsWith(MESSAGING_PATH_PREFIX)
      ? MESSAGING_BASE_URL
      : BASE_URL;

  const url = new URL(`${base}${normalized}`);

  appendSearchParams(url, query);
  appendSearchParams(url, pagination);

  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  // `void` dönen command'lerde gövde boş gelir; `.json()` orada patlar.
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Zarfı çözmeden ham gövdeyi döndürür (token, 401 yenileme ve `ApiError`
 * dönüşümü dahil). Orval mutator'ı üretilen tiplerle birebir uyuşsun diye bunu
 * kullanır; `api()` ise zarfı `execute` içinde normalize eder.
 */
export async function executeRaw(
  endpoint: Pick<AnyEndpoint, 'method' | 'path'>,
  options: RequestOptions<AnyEndpoint>
): Promise<unknown> {
  const url = buildUrl(
    endpoint,
    options.params,
    options.query,
    options.pagination
  );
  const provider = getTokenProvider();

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-source-type': SOURCE_TYPE,
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      return await fetch(url, {
        method: endpoint.method,
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
        credentials: 'include',
      });
    } catch (cause) {
      throw ApiError.network(cause);
    }
  };

  const initialToken = options.token ?? (await provider?.getToken()) ?? null;
  let response = await send(initialToken);

  // Firebase ID token'ı 1 saat ömürlü. 401'de **bir kez** zorla yenileyip
  // tekrar deniyoruz; yine 401 ise sorun token tazeliği değil, oturumun kendisi.
  if (response.status === 401 && provider && !options.token) {
    const refreshed = await provider.getToken(true);

    if (refreshed && refreshed !== initialToken) {
      response = await send(refreshed);
    }

    if (response.status === 401) {
      await provider.onUnauthorized?.();
    }
  }

  const payload = await readBody(response);

  if (!response.ok) {
    throw toApiError(response.status, payload, url);
  }

  return payload;
}

async function execute<E extends AnyEndpoint>(
  endpoint: E,
  options: RequestOptions<AnyEndpoint>
): Promise<ApiResult<ResponseOf<E>>> {
  return normalizeEnvelope<ResponseOf<E>>(await executeRaw(endpoint, options));
}

/**
 * Zarfı soyup yalnız veriyi döndürür — çağrıların çoğu bunu ister.
 *
 * ```ts
 * const id = await api(leadEndpoints.create, { params: { clinicId }, body: dto });
 * ```
 */
export async function api<E extends AnyEndpoint>(
  endpoint: E,
  ...args: ApiArgs<E>
): Promise<ResponseOf<E>> {
  const result = await execute<E>(
    endpoint,
    (args[0] ?? {}) as RequestOptions<AnyEndpoint>
  );
  return result.data;
}

/**
 * Sayfalama bilgisi veya serileştirme grupları gerektiğinde — yani liste
 * ekranlarında — zarfın tamamı.
 */
export async function apiWithMeta<E extends AnyEndpoint>(
  endpoint: E,
  ...args: ApiArgs<E>
): Promise<ApiResult<ResponseOf<E>>> {
  return execute<E>(endpoint, (args[0] ?? {}) as RequestOptions<AnyEndpoint>);
}

export { ApiError };
export type { ApiResult };
