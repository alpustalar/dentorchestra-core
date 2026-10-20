import {
  BookingPaymentProviderValue,
  BookingPaymentRefundKindValue,
  BookingPaymentRefundOriginValue,
  BookingPaymentRefundStatusValue,
} from './booking-payment-refund-types.contracts';

export interface FindUnresolvedBookingPaymentRefundsFilter {
  clinicId?: string;
  status?: BookingPaymentRefundStatusValue;
}

/** Operatörün iyzico panelinde arayıp karar vereceği satır (read-model). */
export interface UnresolvedBookingPaymentRefundRow {
  id: string;
  bookingPaymentId: string;
  clinicId: string;
  kind: BookingPaymentRefundKindValue;
  origin: BookingPaymentRefundOriginValue;
  provider: BookingPaymentProviderValue;
  chargeProviderRef: string;
  amount: string;
  currency: string;
  status: BookingPaymentRefundStatusValue;
  attemptCount: number;
  /** Sağlayıcıya iletilen anahtar (iyzico `conversationId`): panelde bununla aranır. */
  idempotencyKey: string;
  failureReason: string | null;
  requestedAt: Date | null;
  /** PENDING ve süresi geçmiş: çağrı takılmış olabilir. */
  stale: boolean;
}

/**
 * Platform defterine köprülenmesi gereken iade hareketlerinin adayları (read-model).
 * Pencere zorunludur: rapor bir mutabakat aracıdır ve dönem bazında çalışır.
 */
export interface FindBridgeableBookingPaymentRefundsFilter {
  from: Date;
  to: Date;
  clinicId?: string;
}
