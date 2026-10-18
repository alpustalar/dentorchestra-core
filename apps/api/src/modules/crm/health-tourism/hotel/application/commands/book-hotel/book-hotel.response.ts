import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Rezervasyon kaydının kimliği **ve** sağlayıcının fiilen ücretlendirdiği maliyet.
 *
 * Neden sadece id dönmüyor: satış fiyatı teklif anındaki fiyattan türetilir
 * (`net × (1 + komisyon)`) ama ödeme linki saatlerce açık kalabilir ve HotelBeds
 * rezervasyonu **o anki** fiyatla açar. Fiilî maliyet buradan dönmezse aradaki
 * fark komisyonu sessizce yer ve defterdeki tedarikçi borcu (320) sağlayıcının
 * faturalayacağı tutarı göstermez. CLAUDE.md: 3. parti entegrasyon command'i
 * dönüşünde anlık metadata taşıyabilir.
 */
export interface BookHotelResponse {
  /** Dahili rezervasyon kaydının id'si. */
  readonly bookingId: string;
  /** Kaydedilen fiilî net maliyet (kuruş ölçeğinde string — `number` değil). */
  readonly supplierAmount: string;
  readonly supplierCurrency: CurrencyType;
}
