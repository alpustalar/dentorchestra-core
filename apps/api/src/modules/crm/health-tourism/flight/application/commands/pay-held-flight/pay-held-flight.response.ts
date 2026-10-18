import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Tutulan koltuğun ödenmesi sonucu. Tutar, Duffel'a **fiilen ödenen** tutardır
 * (kaydın üzerindeki sipariş tutarı); ödeme bu tutarla gönderildiği için
 * sağlayıcı tarafında doğrulanmıştır.
 */
export interface PayHeldFlightResponse {
  readonly bookingId: string;
  readonly supplierAmount: string;
  readonly supplierCurrency: CurrencyType;
}
