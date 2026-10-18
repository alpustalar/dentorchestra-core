import { BaseEvent } from '@common/interfaces/base-event.interface';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { IAuditLog } from '@common/interfaces/audit-log.interface';

export interface PaymentFailedPayload extends IAuditLog {
  /** Hangi taksitin tahsilatı başarısız oldu — denetim izi ve mutabakat için. */
  installmentId: string;
  paymentId: string;
  appointmentId: string | null;
  clinicId: string;
}

export class PaymentFailedEvent extends BaseEvent {
  static readonly NAME = PAYMENT_EVENTS.FAILED;

  public readonly installmentId: string;
  public readonly paymentId: string;
  public readonly appointmentId: string | null;
  public readonly clinicId: string;

  constructor(payload: PaymentFailedPayload) {
    super({
      action: payload.action,
      source: payload.source,
      metadata: payload.metadata,
      details: payload.details,
      type: payload.type,
      // actorId super'e geçmiyordu: başarısız ödeme denetim kaydı "kim/hangi kanal"
      // bilgisi olmadan yazılıyordu.
      actorId: payload.actorId,
    });
    this.installmentId = payload.installmentId;
    this.paymentId = payload.paymentId;
    this.appointmentId = payload.appointmentId;
    this.clinicId = payload.clinicId;
  }
}
