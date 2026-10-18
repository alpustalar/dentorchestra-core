import { BaseEvent } from '@common/interfaces';
import { FINANCIAL_EVENT_EVENTS } from '@src/domain/constants/events';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';

export interface FinancialEventRecordedPayload {
  financialEventId: string;
  /**
   * Defter sahibi şube. Olay organizasyon kapsamında değil **klinik** defterine
   * yazılır; fiş üretilemediğinde tek görünür iz olan CRITICAL uyarı, hangi
   * defterin eksik kaldığını ancak bu alanla söyleyebilir (uyarı `clinicId: null`
   * ile gidiyordu → "bir yerde mizan eksik" diyen, kiracısı bilinmeyen alarm).
   */
  clinicId: string;
  organizationId: string;
  type: FinancialEventType;
}

/**
 * Bir ekonomik olay kalıcı olarak yazıldığında raise edilir.
 * Posting modülündeki listener bunu yakalayıp fişi (JournalEntry) üretir.
 * Audit log değildir → BaseEvent'e log geçilmez.
 */
export class FinancialEventRecordedEvent extends BaseEvent {
  static readonly NAME = FINANCIAL_EVENT_EVENTS.RECORDED;

  public readonly financialEventId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly type: FinancialEventType;

  constructor(payload: FinancialEventRecordedPayload) {
    super();
    this.financialEventId = payload.financialEventId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.type = payload.type;
  }
}
