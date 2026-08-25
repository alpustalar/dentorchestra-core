import type { FlightOffer } from '@modules/crm/health-tourism/flight/domain/contracts';
import type { FlightPassenger } from '@shared/modules/health-tourism/types/commands';

export const DUFFEL_API_SERVICE = Symbol('IDuffelApiService');

export interface FlightSearchParams {
  originIata: string;
  destinationIata: string;
  /** YYYY-MM-DD */
  departureDate: string;
  /** Doluysa gidiş-dönüş aranır. */
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface CreateFlightOrderParams {
  offerId: string;
  passengers: FlightPassenger[];
  contactEmail: string;
  contactPhone: string;
  /** Duffel `metadata` — dahili korelasyon (bookingPaymentId vb.). */
  metadata?: Record<string, string>;
}

export interface FlightOrderResult {
  orderId: string;
  /** Havayolu PNR'ı; hold siparişinde de dolu gelir. */
  bookingReference: string | null;
  totalAmount: string;
  currency: string;
  /** Hold siparişinde ödeme son tarihi; instant siparişte null. */
  paymentRequiredBy: string | null;
}

export interface FlightCancellationResult {
  cancellationId: string;
  refundAmount: string | null;
  refundCurrency: string | null;
}

/**
 * Duffel uçuş sağlayıcısı portu. Adapter'ın döndürdüğü her şey domain read-model'idir;
 * ham Duffel tipleri bu sınırın ötesine geçmez (yozlaşma-önleyici katman).
 */
export interface IDuffelApiService {
  /** Teklif arar. Desteklenmeyen para birimindeki teklifler elenir. */
  searchOffers(params: FlightSearchParams): Promise<FlightOffer[]>;

  /** Tek teklifi tazeler; bayatlamışsa `null` döner. */
  getOffer(offerId: string): Promise<FlightOffer | null>;

  /**
   * Koltuğu tutar, ödemeyi ertelemez (`type: 'pay_later'`). Yalnız
   * `requiresInstantPayment === false` olan tekliflerde kullanılabilir.
   */
  createHoldOrder(params: CreateFlightOrderParams): Promise<FlightOrderResult>;

  /** Ödemeyle birlikte sipariş açar (`type: 'instant'`, Duffel bakiyesinden). */
  createInstantOrder(
    params: CreateFlightOrderParams
  ): Promise<FlightOrderResult>;

  /** Tutulan siparişi Duffel bakiyesinden öder. */
  payOrder(params: {
    orderId: string;
    amount: string;
    currency: string;
  }): Promise<void>;

  cancelOrder(orderId: string): Promise<FlightCancellationResult>;
}
