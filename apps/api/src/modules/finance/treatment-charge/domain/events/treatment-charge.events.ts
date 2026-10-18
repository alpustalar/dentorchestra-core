import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { TREATMENT_CHARGE_EVENTS } from '@src/domain/constants/events';

/**
 * Fiyatlı işlem satırının yaşam döngüsü olayları.
 *
 * Satır faturanın **ticari dayanağıdır**: ne eklendiği, kimin hangi indirimi
 * verdiği ve satırı kimin iptal ettiği kalıcı bir iz gerektirir (CLAUDE.md
 * finans kuralı 7). Daha önce `TREATMENT_CHARGE_EVENTS` sabitleri yalnız
 * **yetki hatası** loglamasında kullanılıyordu; başarılı ekleme/indirim/iptal
 * hiçbir yere yazılmıyordu — indirim geçmişi (%40 → %0 → %45) ve iptali yapan
 * personel kaybolmuş oluyordu.
 */
interface TreatmentChargeEventPayload extends IAuditLog {
  readonly chargeId: string;
  readonly clinicId: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly treatmentId: string;
}

abstract class TreatmentChargeBaseEvent extends BaseEvent {
  public readonly chargeId: string;
  public readonly clinicId: string;
  public readonly appointmentId: string;
  public readonly patientId: string;
  public readonly treatmentId: string;

  protected constructor(payload: TreatmentChargeEventPayload) {
    super({
      action: payload.action,
      source: payload.source,
      actorId: payload.actorId,
      type: payload.type,
      details: payload.details,
      metadata: payload.metadata,
    });
    this.chargeId = payload.chargeId;
    this.clinicId = payload.clinicId;
    this.appointmentId = payload.appointmentId;
    this.patientId = payload.patientId;
    this.treatmentId = payload.treatmentId;
  }
}

export interface TreatmentChargeAddedEventPayload extends TreatmentChargeEventPayload {
  readonly grossAmount: string;
  readonly currency: string;
  readonly discountRate: string;
}

export class TreatmentChargeAddedEvent extends TreatmentChargeBaseEvent {
  static readonly NAME = TREATMENT_CHARGE_EVENTS.ADDED;

  public readonly grossAmount: string;
  public readonly currency: string;
  public readonly discountRate: string;

  constructor(payload: TreatmentChargeAddedEventPayload) {
    super(payload);
    this.grossAmount = payload.grossAmount;
    this.currency = payload.currency;
    this.discountRate = payload.discountRate;
  }
}

export interface TreatmentChargeDiscountUpdatedEventPayload extends TreatmentChargeEventPayload {
  /** İndirim geçmişi satırda tutulmuyor; iz yalnız bu olayda kalır. */
  readonly previousDiscountRate: string;
  readonly discountRate: string;
  readonly grossAmount: string;
  readonly currency: string;
  readonly exceededLimit: boolean;
}

export class TreatmentChargeDiscountUpdatedEvent extends TreatmentChargeBaseEvent {
  static readonly NAME = TREATMENT_CHARGE_EVENTS.DISCOUNT_UPDATED;

  public readonly previousDiscountRate: string;
  public readonly discountRate: string;
  public readonly grossAmount: string;
  public readonly currency: string;
  public readonly exceededLimit: boolean;

  constructor(payload: TreatmentChargeDiscountUpdatedEventPayload) {
    super(payload);
    this.previousDiscountRate = payload.previousDiscountRate;
    this.discountRate = payload.discountRate;
    this.grossAmount = payload.grossAmount;
    this.currency = payload.currency;
    this.exceededLimit = payload.exceededLimit;
  }
}

export interface TreatmentChargeVoidedEventPayload extends TreatmentChargeEventPayload {
  readonly reason: string;
  readonly grossAmount: string;
  readonly currency: string;
}

export class TreatmentChargeVoidedEvent extends TreatmentChargeBaseEvent {
  static readonly NAME = TREATMENT_CHARGE_EVENTS.VOIDED;

  public readonly reason: string;
  public readonly grossAmount: string;
  public readonly currency: string;

  constructor(payload: TreatmentChargeVoidedEventPayload) {
    super(payload);
    this.reason = payload.reason;
    this.grossAmount = payload.grossAmount;
    this.currency = payload.currency;
  }
}
