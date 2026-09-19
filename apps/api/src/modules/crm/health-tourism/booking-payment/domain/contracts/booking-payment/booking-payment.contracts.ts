import { BookingPayment as IBookingPayment } from '@generated/index';

export type BookingPaymentTypeValue = IBookingPayment['bookingType'];
export type BookingPaymentStatusValue = IBookingPayment['status'];
export type BookingPaymentProviderValue = NonNullable<
  IBookingPayment['paidProvider']
>;
export type Currency = IBookingPayment['saleCurrency'];

/** Otel rezervasyonu pax'ı — ödeme sonrası BookHotelCommand'a replay edilir. */
export interface HotelIntentPax {
  roomId: number;
  type: 'AD' | 'CH';
  name: string;
  surname: string;
  age?: number;
}

export interface HotelBookingIntent {
  type: 'HOTEL';
  hotelCode: string;
  hotelName: string;
  checkIn: string; // ISO
  checkOut: string; // ISO
  holderName: string;
  holderSurname: string;
  rooms: Array<{ rateKey: string; paxes: HotelIntentPax[] }>;
  remarks?: string;
}

export interface TransferIntentDetail {
  type: 'FLIGHT' | 'CRUISE' | 'TRAIN';
  direction: 'ARRIVAL' | 'DEPARTURE';
  code: string;
}

export interface TransferBookingIntent {
  type: 'TRANSFER';
  language: string;
  vehicleName: string;
  holderName: string;
  holderSurname: string;
  holderEmail: string;
  holderPhone: string;
  transfers: Array<{
    rateKey: string;
    transferDetails: TransferIntentDetail[];
  }>;
}

/**
 * Uçuş niyeti kendi içinde ikiye ayrılır (hibrit ödeme akışı):
 *
 * - `HOLD`: koltuk tahsilattan ÖNCE Duffel'da tutuldu. Ödeme onayında yapılacak iş
 *   siparişi açmak değil, tutulan siparişi ödemektir → `duffelOrderId` taşınır.
 * - `INSTANT`: havayolu anında ödeme istiyor; sipariş ancak tahsilat onayında,
 *   ödemeyle birlikte açılabilir → teklif (`optionId`) taşınır.
 */
export interface FlightHoldBookingIntent {
  type: 'FLIGHT';
  mode: 'HOLD';
  /** Hold sırasında yaratılan dahili kayıt — ödeme onayında bu güncellenir. */
  flightBookingId: string;
  duffelOrderId: string;
  summary: string;
}

export interface FlightInstantBookingIntent {
  type: 'FLIGHT';
  mode: 'INSTANT';
  /** Cache'teki kısa teklif token'ı; sipariş onayda bununla açılır. */
  optionId: string;
  clinicId: string;
  passengers: FlightIntentPassenger[];
  contactEmail: string;
  contactPhone: string;
  summary: string;
}

export interface FlightIntentPassenger {
  type: 'adult' | 'child' | 'infant_without_seat';
  title?: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  givenName: string;
  familyName: string;
  bornOn: string;
  gender?: 'm' | 'f';
}

export type FlightBookingIntent =
  | FlightHoldBookingIntent
  | FlightInstantBookingIntent;

/** Ödeme onaylanınca sağlayıcıya replay edilecek rezervasyon niyeti. */
export type BookingIntent =
  | HotelBookingIntent
  | TransferBookingIntent
  | FlightBookingIntent;

/** Entity static create() girişi. Tutarlar düz sayı; entity Decimal'e çevirir. */
export interface CreateBookingPaymentProps {
  id?: string;
  bookingType: BookingPaymentTypeValue;
  saleCurrency: Currency;
  saleAmount: number;
  tryAmount: number;
  netAmount: number;
  fxRate: number | null;
  intent: BookingIntent;
  clinicId: string;
  organizationId: string;
  patientId: string | null;
  leadId: string | null;
  conversationId: string | null;
}

/** initiate sonrası üretilen sağlayıcı link bilgileri. */
export interface BookingPaymentLinks {
  iyzicoConversationId?: string | null;
  iyzicoToken?: string | null;
  iyzicoUrl?: string | null;
  stripeSessionId?: string | null;
  stripeUrl?: string | null;
}
