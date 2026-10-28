/**
 * Backend'in hata sözleşmesi (`BaseExceptionFilter`):
 *
 * ```jsonc
 * { "success": false, "statusCode": 409, "path": "/api/v1/...",
 *   "code": "APPOINTMENT.SLOT_CONFLICT", "error": "Seçilen randevu saatleri dolu.",
 *   "meta": { ... }, "timestamp": "..." }
 * ```
 *
 * Alan adlarına dikkat: mesaj `error`, kod `code`. Filtreyi okuyarak doğrulandı.
 */
export interface ApiErrorBody {
  success: false;
  statusCode: number;
  path: string;
  code: string;
  error: string;
  meta?: unknown;
  timestamp: string;
}

/**
 * `meta` bilinçli olarak jenerik: her domain exception'ı kendi tipli payload'ını
 * taşır ve o tip `@dentorchestra/shared/client` üzerinden **aynı arayüzden** gelir
 * (ör. `SlotConflictMeta`). Böylece hata anında akıllı UI kurulabilir:
 *
 * ```ts
 * if (error instanceof ApiError && error.code === 'APPOINTMENT.SLOT_CONFLICT') {
 *   const meta = error.meta as SlotConflictMeta;
 *   showAlternatives(meta.suggestedNextAvailableSlot);
 * }
 * ```
 */
export class ApiError<TMeta = unknown> extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly meta?: TMeta,
    readonly path?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Ağ/CORS gibi cevaba hiç ulaşamadığımız durumlar. */
  static network(cause: unknown): ApiError {
    return new ApiError(
      'NETWORK_ERROR',
      0,
      'Sunucuya ulaşılamadı. Bağlantını kontrol et.',
      { cause }
    );
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /** Optimistic locking çakışması — "kayıt başkası tarafından güncellendi". */
  get isConflict(): boolean {
    return this.statusCode === 409;
  }
}

/** Cevap gövdesini `ApiError`'a çevirir; sözleşmeye uymayan gövdelerde de çalışır. */
export function toApiError(status: number, body: unknown, path: string): ApiError {
  if (body && typeof body === 'object' && 'code' in body) {
    const errorBody = body as Partial<ApiErrorBody>;
    return new ApiError(
      errorBody.code ?? 'UNKNOWN',
      errorBody.statusCode ?? status,
      errorBody.error ?? 'Beklenmeyen bir hata oluştu.',
      errorBody.meta,
      errorBody.path ?? path
    );
  }

  // Sözleşme dışı gövde (ör. ters vekilin ürettiği 502 HTML sayfası).
  return new ApiError(
    'UNKNOWN',
    status,
    typeof body === 'string' && body ? body : 'Beklenmeyen bir hata oluştu.',
    undefined,
    path
  );
}
