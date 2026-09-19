/**
 * Hold sonrası saga'nın ihtiyaç duyduğu asgari metadata: ödeme onayında hangi
 * Duffel siparişinin ödeneceği ve hangi dahili kaydın güncelleneceği.
 */
export interface HoldFlightResponse {
  /** Dahili rezervasyon kaydının id'si. */
  bookingId: string;
  duffelOrderId: string;
  /** Ödemenin yapılması gereken son an (ISO 8601); Duffel vermezse null. */
  paymentRequiredBy: string | null;
}
