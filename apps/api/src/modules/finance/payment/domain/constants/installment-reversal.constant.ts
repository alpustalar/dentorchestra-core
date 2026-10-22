/**
 * Sonucu kesinleşmemiş (zaman aşımı) bir iade/iptal girişiminin damgası, bu süre
 * dolduktan sonra AYNI yolun yeniden denenmesine izin verir (sağlayıcı iade
 * kimliğine göre idempotent; ikinci çağrı "zaten iade" diye reddeder).
 *
 * Süre yalnız yeniden denemeyi açar. Kart itirazı bundan etkilenmez: damga doluysa
 * itiraz süreden bağımsız reddedilir — para sağlayıcıda çıkmış olabilir.
 */
export const REVERSAL_RETRY_AFTER_MINUTES = 10;
