import { BookingPaymentTypeValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/** Rezervasyonun tedarikçisi — platform defterinde 320 carisi olarak açılır. */
export interface BookingSupplierIdentity {
  /** Cari kimliği (`PartyOriginType.EXTERNAL` altında sabit anahtar). */
  readonly originId: string;
  readonly name: string;
}

/**
 * Rezervasyon tipi → tedarikçi carisi.
 *
 * `satisfies Record<BookingPaymentTypeValue, …>`: yeni bir rezervasyon tipi
 * eklendiğinde tedarikçisi **derleme zamanında** sorulur. Eksik bırakılırsa 320
 * satırı carisiz kalır ve fiş `PartyRequiredForAccountException` ile reddedilir
 * — yani tahsilat defteri sessizce değil, hiç yazılmaz.
 *
 * Tedarikçi **tahsilat kanalından bağımsızdır**: parayı iyzico ya da Stripe
 * tahsil eder, borç her hâlde rezervasyonu açan sağlayıcıya aittir.
 */
export const BOOKING_SUPPLIERS = {
  HOTEL: { originId: 'HOTELBEDS', name: 'HotelBeds' },
  TRANSFER: { originId: 'HOTELBEDS', name: 'HotelBeds' },
  FLIGHT: { originId: 'DUFFEL', name: 'Duffel' },
} as const satisfies Record<BookingPaymentTypeValue, BookingSupplierIdentity>;

export const resolveBookingSupplier = (
  bookingType: BookingPaymentTypeValue
): BookingSupplierIdentity => BOOKING_SUPPLIERS[bookingType];
