/**
 * Kasa çıkış hareketi çekmecedeki nakdi aştığında dönen hata gövdesi.
 *
 * Arayüz bu üç alanla "şu an çekmecede X var, Y çıkış yapılamaz" diyebilir;
 * personelin tutarı düzeltmesi ya da önce tahsilat/giriş kaydetmesi için
 * gereken bilgi hatanın kendisinde taşınır (CLAUDE.md: `meta` sözleşmesi
 * `@shared`'te, iki uçlu tip güvenliği).
 */
export interface InsufficientCashMeta extends Record<string, unknown> {
  /** Çekmecedeki nakit: açılış + Σgiriş − Σçıkış (kuruş ölçeğinde string). */
  readonly available: string;
  /** Kaydedilmek istenen çıkış tutarı. */
  readonly requested: string;
  /** Oturumun para birimi. */
  readonly currency: string;
}
