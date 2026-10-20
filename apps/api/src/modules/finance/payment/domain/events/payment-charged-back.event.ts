import { BaseEvent } from '@common/interfaces';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { IAuditLog } from '@common/interfaces/audit-log.interface';

export interface PaymentChargedBackEventPayload extends IAuditLog {
  /** Ters ibrazla geri alınan taksit. */
  installmentId: string;
  /** Aynı tutarda açılan telafi taksidi (hastadan yeniden tahsil edilecek). */
  recoveryInstallmentId: string;
  paymentId: string;
  appointmentId: string | null;
  clinicId: string;
}

/**
 * Kart itirazı KAYBEDİLDİ: para iade edilmedi, sağlayıcı kart sahibinin lehine
 * geri aldı. `PaymentRefundedEvent`'in karşılığı DEĞİL — iade bizim kararımızla
 * geri verilen paradır ve hasta borcunu kapatır; bu ise geri alınan paradır ve
 * hasta borcu yerinde durur (telafi taksidi o borcu temsil eder).
 */
export class PaymentChargedBackEvent extends BaseEvent {
  static readonly NAME = PAYMENT_EVENTS.CHARGED_BACK;

  public readonly installmentId: string;
  public readonly recoveryInstallmentId: string;
  public readonly paymentId: string;
  public readonly appointmentId: string | null;
  public readonly clinicId: string;

  constructor(payload: PaymentChargedBackEventPayload) {
    super({
      action: payload.action,
      source: payload.source,
      metadata: payload.metadata,
      details: payload.details,
      type: payload.type,
      actorId: payload.actorId,
    });

    this.installmentId = payload.installmentId;
    this.recoveryInstallmentId = payload.recoveryInstallmentId;
    this.paymentId = payload.paymentId;
    this.appointmentId = payload.appointmentId;
    this.clinicId = payload.clinicId;
  }
}
