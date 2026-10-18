import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { ACCOUNTING_PERIOD_EVENTS } from '@src/domain/constants/events/accounting.constant';

/**
 * Dönem durum geçişlerinin ortak gövdesi. Denetim sorusu ("FY2026'yı kim, ne zaman
 * kapattı; kilitli dönemi kim yeniden açtı") hem kalıcı damga kolonlarıyla
 * (`closedById`/`closedAt`) hem bu olayların audit log'uyla yanıtlanır.
 */
export interface AccountingPeriodEventPayload extends IAuditLog {
  readonly periodId: string;
  readonly clinicId: string;
  readonly organizationId: string;
  readonly year: number;
}

abstract class AccountingPeriodBaseEvent extends BaseEvent {
  public readonly periodId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly year: number;

  protected constructor(payload: AccountingPeriodEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.periodId = payload.periodId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.year = payload.year;
  }
}

export class AccountingPeriodOpenedEvent extends AccountingPeriodBaseEvent {
  static readonly NAME = ACCOUNTING_PERIOD_EVENTS.OPENED;

  constructor(payload: AccountingPeriodEventPayload) {
    super(payload);
  }
}

export class AccountingPeriodLockedEvent extends AccountingPeriodBaseEvent {
  static readonly NAME = ACCOUNTING_PERIOD_EVENTS.LOCKED;

  constructor(payload: AccountingPeriodEventPayload) {
    super(payload);
  }
}

export class AccountingPeriodReopenedEvent extends AccountingPeriodBaseEvent {
  static readonly NAME = ACCOUNTING_PERIOD_EVENTS.REOPENED;

  constructor(payload: AccountingPeriodEventPayload) {
    super(payload);
  }
}

export class AccountingPeriodClosedEvent extends AccountingPeriodBaseEvent {
  static readonly NAME = ACCOUNTING_PERIOD_EVENTS.CLOSED;

  constructor(payload: AccountingPeriodEventPayload) {
    super(payload);
  }
}
