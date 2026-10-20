import { Money } from '@src/domain/value-objects/money.vo';
import {
  BookingPaymentProviderValue,
  BookingPaymentRefundKindValue,
  BookingPaymentRefundResolutionValue,
} from './booking-payment-refund-types.contracts';

/** Entity `request()` girişi. Tutar VO'dur: para birimi tutardan ayrı taşınmaz. */
export interface RequestBookingPaymentRefundProps {
  id?: string;
  bookingPaymentId: string;
  clinicId: string;
  organizationId: string;
  kind: BookingPaymentRefundKindValue;
  provider: BookingPaymentProviderValue;
  /** İade edilen tahsilat: iyzico paymentTransactionId / stripe payment_intent. */
  chargeProviderRef: string;
  amount: Money;
  reason?: string | null;
  requestedById?: string | null;
}

export interface SettleBookingPaymentRefundProps {
  /** Sağlayıcı çağrısını başlatan girişim; araya başka girişim girdiyse geçiş reddedilir. */
  attempt: number;
}

export interface ConfirmByProviderProps extends SettleBookingPaymentRefundProps {
  providerRefundRef: string | null;
}

export interface RejectByProviderProps extends SettleBookingPaymentRefundProps {
  failureReason: string;
}

export interface MarkUnconfirmedProps extends SettleBookingPaymentRefundProps {
  failureReason: string;
}

/** Operatörün elle kararı (kural 7: kim / ne zaman / neye dayanarak). */
export interface ResolveBookingPaymentRefundProps {
  outcome: BookingPaymentRefundResolutionValue;
  resolvedById: string;
  note: string;
  /** CONFIRMED'da zorunlu; sağlayıcıda iadenin gerçekleştiği an. */
  refundedAt?: Date;
  providerRefundRef?: string | null;
}
