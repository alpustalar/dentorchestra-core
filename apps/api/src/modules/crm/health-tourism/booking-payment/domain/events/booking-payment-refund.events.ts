import { BOOKING_PAYMENT_REFUND_EVENTS } from '@src/domain/constants/events/health-tourism.constant';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { BaseEvent } from '@common/interfaces';

export interface BookingPaymentRefundResolvedEventPayload {
  readonly refundId: string;
  readonly bookingPaymentId: string;
  readonly clinicId: string;
  readonly outcome: 'CONFIRMED' | 'NOT_REFUNDED';
  readonly resolvedById: string;
  readonly note: string;
}

/**
 * Doğrulanmamış bir iade elle kapatıldı. Bu bir PARA kararıdır (kural 7): kim / ne zaman /
 * neye dayanarak kalıcı olarak hem satırda hem denetim izinde durur.
 */
export class BookingPaymentRefundResolvedEvent extends BaseEvent {
  static readonly NAME = BOOKING_PAYMENT_REFUND_EVENTS.RESOLVED;

  public readonly refundId: string;
  public readonly bookingPaymentId: string;
  public readonly clinicId: string;
  public readonly outcome: 'CONFIRMED' | 'NOT_REFUNDED';

  constructor(payload: BookingPaymentRefundResolvedEventPayload) {
    super({
      action: LogAction.BOOKING_PAYMENT_REFUND_RESOLVED,
      type: LogType.WARNING,
      source: LogSource.WEB,
      actorId: payload.resolvedById,
      details: {
        refundId: payload.refundId,
        bookingPaymentId: payload.bookingPaymentId,
        clinicId: payload.clinicId,
        outcome: payload.outcome,
        note: payload.note,
      },
    });
    this.refundId = payload.refundId;
    this.bookingPaymentId = payload.bookingPaymentId;
    this.clinicId = payload.clinicId;
    this.outcome = payload.outcome;
  }
}

export interface BookingPaymentRefundRetriedEventPayload {
  readonly refundId: string;
  readonly bookingPaymentId: string;
  readonly clinicId: string;
  readonly attempt: number;
  readonly retriedById: string;
}

export class BookingPaymentRefundRetriedEvent extends BaseEvent {
  static readonly NAME = BOOKING_PAYMENT_REFUND_EVENTS.RETRIED;

  public readonly refundId: string;
  public readonly bookingPaymentId: string;
  public readonly clinicId: string;
  public readonly attempt: number;

  constructor(payload: BookingPaymentRefundRetriedEventPayload) {
    super({
      action: LogAction.BOOKING_PAYMENT_REFUND_RETRIED,
      type: LogType.WARNING,
      source: LogSource.WEB,
      actorId: payload.retriedById,
      details: {
        refundId: payload.refundId,
        bookingPaymentId: payload.bookingPaymentId,
        clinicId: payload.clinicId,
        attempt: payload.attempt,
      },
    });
    this.refundId = payload.refundId;
    this.bookingPaymentId = payload.bookingPaymentId;
    this.clinicId = payload.clinicId;
    this.attempt = payload.attempt;
  }
}
