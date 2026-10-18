import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { JOURNAL_ENTRY_EVENTS } from '@src/domain/constants/events/accounting.constant';

/**
 * Storno denetim izi. Mühürlenmiş bir fişin etkisini götürmek defterdeki en
 * yüksek etkili elle işlemdir; "hangi fişi, hangi ters kayıtla, kim, neden
 * iptal etti" sorusu bu olayın audit log'uyla yanıtlanır.
 */
export interface JournalEntryReversedEventPayload extends IAuditLog {
  readonly entryId: string;
  readonly reversalId: string;
  readonly clinicId: string;
  readonly organizationId: string;
  readonly periodId: string;
  /** Orijinal fişin yevmiye numarası (biçimlenmiş); numarasızsa null. */
  readonly entryNo: string | null;
  readonly reason: string | null;
}

export class JournalEntryReversedEvent extends BaseEvent {
  static readonly NAME = JOURNAL_ENTRY_EVENTS.REVERSED;

  public readonly entryId: string;
  public readonly reversalId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly periodId: string;
  public readonly entryNo: string | null;
  public readonly reason: string | null;

  constructor(payload: JournalEntryReversedEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.entryId = payload.entryId;
    this.reversalId = payload.reversalId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.periodId = payload.periodId;
    this.entryNo = payload.entryNo;
    this.reason = payload.reason;
  }
}
