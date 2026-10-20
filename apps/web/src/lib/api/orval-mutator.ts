import { executeRaw } from './client';

/**
 * Orval'in her üretilen çağrıda kullandığı taşıyıcı. Kendi `fetch`'ini yazmak
 * yerine `executeRaw`'a bağlanır: Firebase token'ı, 401'de tek sefer yenileme,
 * `x-source-type` başlığı ve `ApiError` dönüşümü aynen çalışır.
 *
 * Ham gövde döner (zarf soyulmaz) çünkü üretilen tipler `{ data, meta? }`
 * zarfını birebir yansıtır; zarfı çözmek çağıranın işi.
 */

/** Swagger yolları `/api/v1` öneklidir; `BASE_URL` zaten onu taşır. */
const API_PREFIX = '/api/v1';

export interface OrvalRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, unknown>;
  data?: unknown;
  /** Üretilen kod geçer ama yok sayılır: `executeRaw` başlıkları kendisi kurar. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const orvalMutator = <T>(config: OrvalRequestConfig): Promise<T> => {
  const path = config.url.startsWith(API_PREFIX)
    ? config.url.slice(API_PREFIX.length)
    : config.url;

  return executeRaw(
    { method: config.method, path },
    {
      query: config.params,
      body: config.data,
      signal: config.signal,
    } as never
  ) as Promise<T>;
};

export type ErrorType<E> = E;
