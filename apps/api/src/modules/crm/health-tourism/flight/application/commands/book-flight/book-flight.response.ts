import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Uçuş siparişinin yerel kaydı **ve** Duffel'ın sipariş için fiilen ücretlendirdiği
 * tutar. Uçuşta fark şu yüzden kritik: `createInstantOrder` ödemeyi **teklifi
 * yeniden çekerek** gönderir, yani havayolu fiyatı değiştiyse ödenen tutar teklif
 * anındakinden farklıdır. Sipariş yanıtı bu tutarı taşıyor ama eskiden
 * atılıyordu — kayda önbellekteki teklif tutarı yazılıyordu.
 */
export interface BookFlightResponse {
  readonly bookingId: string;
  /** Kaydedilen fiilî sipariş tutarı (kuruş ölçeğinde string). */
  readonly supplierAmount: string;
  readonly supplierCurrency: CurrencyType;
}
