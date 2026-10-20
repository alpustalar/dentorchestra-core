export const HEALTH_TOURISM_CONFIG_EVENTS = {
  CONFIG: 'health-tourism-config',
} as const;

export type HealthTourismConfigEvent =
  (typeof HEALTH_TOURISM_CONFIG_EVENTS)[keyof typeof HEALTH_TOURISM_CONFIG_EVENTS];

export const HOTEL_BOOKING_EVENTS = {
  CREATED: 'hotel-booking.created',
  CANCELLED: 'hotel-booking.cancelled',
} as const;

export type HotelBookingEvent =
  (typeof HOTEL_BOOKING_EVENTS)[keyof typeof HOTEL_BOOKING_EVENTS];

export const FLIGHT_BOOKING_EVENTS = {
  /** Duffel'da sipariş açıldı (hold veya ödenmiş). */
  CREATED: 'flight-booking.created',
  /** Tutulan koltuk ödendi, bilet kesildi. */
  CONFIRMED: 'flight-booking.confirmed',
  CANCELLED: 'flight-booking.cancelled',
} as const;

export type FlightBookingEvent =
  (typeof FLIGHT_BOOKING_EVENTS)[keyof typeof FLIGHT_BOOKING_EVENTS];

export const BOOKING_PAYMENT_REFUND_EVENTS = {
  /** Operatör doğrulanmamış iadeyi elle kapattı (CONFIRMED / NOT_REFUNDED). */
  RESOLVED: 'booking-payment-refund.resolved',
  /** Operatör reddedilmiş iadeyi yeniden denemeye açtı. */
  RETRIED: 'booking-payment-refund.retried',
} as const;

export type BookingPaymentRefundEvent =
  (typeof BOOKING_PAYMENT_REFUND_EVENTS)[keyof typeof BOOKING_PAYMENT_REFUND_EVENTS];
