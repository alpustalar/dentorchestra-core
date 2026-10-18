import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Transfer rezervasyon kaydının kimliği **ve** sağlayıcının fiilen ücretlendirdiği
 * tutar. Gerekçe `BookHotelResponse` ile aynıdır: teklif ile rezervasyon arasında
 * fiyat değişebilir ve fark ödeme kaydıyla karşılaştırılmazsa sessizce komisyondan
 * düşer.
 */
export interface BookTransferResponse {
  readonly bookingId: string;
  /** Kaydedilen fiilî tutar (kuruş ölçeğinde string). */
  readonly supplierAmount: string;
  readonly supplierCurrency: CurrencyType;
}
