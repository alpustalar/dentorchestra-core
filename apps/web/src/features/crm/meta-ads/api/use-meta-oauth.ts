'use client';

import { useMutation } from '@tanstack/react-query';
import { metaAdsEndpoints } from '@core-crm/shared/client';

import { api } from '@/lib/api';

/**
 * `{ url }` backend'de Swagger'a tanımlanmamış (Orval'ın ürettiği istemci onu
 * `void` sayıyor) — `defineEndpoint` ile burada doğru tipleniyor, backend
 * değişikliği gerekmiyor (bkz. plan notu).
 *
 * Tam sayfa yönlendirme kasıtlı: Meta'nın kendi giriş ekranına gidiliyor,
 * `fetch`/XHR ile değil `window.location.href` ile.
 */
export function useConnectMetaAccount() {
  return useMutation({
    mutationFn: async ({
      clinicId,
      returnPath,
    }: {
      clinicId: string;
      returnPath: string;
    }) => {
      const { url } = await api(metaAdsEndpoints.oauthAuthorize, {
        query: { clinicId, returnPath },
      });
      window.location.href = url;
    },
  });
}
