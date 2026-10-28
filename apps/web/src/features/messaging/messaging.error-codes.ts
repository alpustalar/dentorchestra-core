import type { ServiceWindowClosedMeta } from '@dentorchestra/shared/client';

import { ApiError } from '@/lib/api';

export const MESSAGING_ERROR_CODES = {
  SERVICE_WINDOW_CLOSED: 'MESSAGING.SERVICE_WINDOW_CLOSED',
} as const;

/**
 * WhatsApp 24s servis penceresi kapalı mı? Hata **koduna** bakılır, metnine
 * değil: metin değiştiğinde sessizce bozulan bir bağ olurdu. `meta` sözleşmesi
 * `@shared`'te, backend exception'ı da aynı tipi kullanıyor.
 */
export function asServiceWindowClosed(
  error: unknown
): ServiceWindowClosedMeta | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code !== MESSAGING_ERROR_CODES.SERVICE_WINDOW_CLOSED) {
    return null;
  }
  return (error.meta as ServiceWindowClosedMeta) ?? null;
}
