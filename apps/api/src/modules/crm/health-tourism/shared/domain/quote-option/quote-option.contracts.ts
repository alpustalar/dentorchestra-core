/** Fiyat teklifini üreten dikey. Uyarı/log'da hangi akış olduğunu söyler. */
export type QuoteOptionKind = 'HOTEL' | 'TRANSFER' | 'FLIGHT';

/**
 * Teklifin **sahibi**: hangi kiracının hangi görüşmesinde üretildi.
 *
 * Teklif Redis'te durur ve içinde hastanın ödeyeceği tutarın temeli (`net`) ile
 * sağlayıcıya gidecek rezervasyon anahtarı (`rateKey` / `offerId`) vardır. Yani
 * **bir para kararı** taşır; kararın kime ait olduğu kaydın içinde yazılı olmazsa
 * anahtarı bilen herkesin kararı olur.
 */
export interface QuoteOptionOwner {
  readonly clinicId: string;
  readonly conversationId: string;
}

/**
 * Teklifi kullanmak isteyen tarafın kapsamı. Görüşme bağlamı olan çağıran
 * (AI aracı) `conversationId` taşır ve **birebir** eşleşmek zorundadır; görüşme
 * bağlamı olmayan çağıran (personelin HTTP ucu, kendi kliniği policy ile
 * doğrulanmış) `null` taşır ve yalnız kiracı eşleşmesi aranır.
 *
 * Yani iddia **daralabilir ama genişleyemez**: klinik her zaman eşleşir.
 */
export interface QuoteOptionClaim {
  readonly clinicId: string;
  readonly conversationId: string | null;
}

/** Teklif sahiplik kontrolünün ret sebepleri. */
export type QuoteOptionRejection =
  /** Kayıtta sahip bilgisi yok — sahiplik kuralından önce yazılmış (TTL ≤ 15 dk). */
  | 'OWNER_MISSING'
  /** Başka bir kiracının teklifi. */
  | 'CLINIC_MISMATCH'
  /** Aynı kiracı, **başka bir görüşme** — başka hastanın teklifi. */
  | 'CONVERSATION_MISMATCH';
