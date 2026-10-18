/**
 * Outbox teslim parametreleri — **tek yer**. Sahiplenme (repository) ile deneme
 * sınırı (processor) aynı sözleşmenin iki yarısıdır: ayrı dosyalara kopyalanırsa
 * biri değişip diğeri kalır ve kayıt ya hiç dead-letter olmaz ya hiç denenmez.
 */

/** Bir turda sahiplenilecek en fazla kayıt. */
export const OUTBOX_BATCH_SIZE = 100;

/**
 * Sahiplenme (lease) süresi. Bu süre geçtikten sonra kayıt başka bir işçi
 * tarafından devralınabilir — hem teslim ortasında çöken süreci kurtarır hem
 * başarısız denemeler arasına bekleme koyar (5 saniyelik yoklama aralığıyla
 * sonsuz döngü kurmasın).
 */
export const OUTBOX_CLAIM_LEASE_MS = 60_000;

/**
 * Kaç denemeden sonra kayıt ölü mektuba düşer. Kalıcı bir hatada (poison pill)
 * kaydın sonsuza kadar her 5 saniyede yeniden yayınlanması, aynı event'in
 * başarılı diğer dinleyicilerini de tekrar tekrar tetikler — e-posta, bildirim
 * ve sağlayıcı çağrıları çoğalır. Ölü mektup bu döngüyü keser ve kaydı
 * **görünür** bırakır: silinmez, elle müdahale bekler.
 */
export const OUTBOX_MAX_ATTEMPTS = 10;
