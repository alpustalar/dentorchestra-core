import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { FLIGHT_BOOKING_EVENTS } from '@src/domain/constants/events/health-tourism.constant';

interface FlightBookingEventBase extends IAuditLog {
  readonly bookingId: string;
  readonly duffelOrderId: string;
  readonly clinicId: string;
  readonly organizationId: string;
  readonly patientId: string | null;
  readonly leadId: string | null;
}

export interface FlightBookingCreatedEventPayload extends FlightBookingEventBase {
  readonly mode: string;
  readonly totalAmount: string;
  readonly currency: string;
  /** Hold yolunda ödeme son tarihi; instant siparişte null. */
  readonly holdExpiresAt: string | null;
}

export class FlightBookingCreatedEvent extends BaseEvent {
  static readonly NAME = FLIGHT_BOOKING_EVENTS.CREATED;

  public readonly bookingId: string;
  public readonly duffelOrderId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly patientId: string | null;
  public readonly leadId: string | null;
  public readonly mode: string;
  public readonly totalAmount: string;
  public readonly currency: string;
  public readonly holdExpiresAt: string | null;

  constructor(payload: FlightBookingCreatedEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.bookingId = payload.bookingId;
    this.duffelOrderId = payload.duffelOrderId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.patientId = payload.patientId;
    this.leadId = payload.leadId;
    this.mode = payload.mode;
    this.totalAmount = payload.totalAmount;
    this.currency = payload.currency;
    this.holdExpiresAt = payload.holdExpiresAt;
  }
}

export interface FlightBookingConfirmedEventPayload extends FlightBookingEventBase {
  /** Havayolu PNR'ı — transfer/karşılama akışı bunu kullanır. */
  readonly bookingReference: string | null;
}

export class FlightBookingConfirmedEvent extends BaseEvent {
  static readonly NAME = FLIGHT_BOOKING_EVENTS.CONFIRMED;

  public readonly bookingId: string;
  public readonly duffelOrderId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly patientId: string | null;
  public readonly leadId: string | null;
  public readonly bookingReference: string | null;

  constructor(payload: FlightBookingConfirmedEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.bookingId = payload.bookingId;
    this.duffelOrderId = payload.duffelOrderId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.patientId = payload.patientId;
    this.leadId = payload.leadId;
    this.bookingReference = payload.bookingReference;
  }
}

export interface FlightBookingCancelledEventPayload extends FlightBookingEventBase {
  readonly reason: string | null;
}

export class FlightBookingCancelledEvent extends BaseEvent {
  static readonly NAME = FLIGHT_BOOKING_EVENTS.CANCELLED;

  public readonly bookingId: string;
  public readonly duffelOrderId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly patientId: string | null;
  public readonly leadId: string | null;
  public readonly reason: string | null;

  constructor(payload: FlightBookingCancelledEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.bookingId = payload.bookingId;
    this.duffelOrderId = payload.duffelOrderId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.patientId = payload.patientId;
    this.leadId = payload.leadId;
    this.reason = payload.reason;
  }
}
