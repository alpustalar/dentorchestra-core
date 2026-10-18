import { CHART_OF_ACCOUNTS_EVENTS } from '@src/domain/constants/events/accounting.constant';
import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';

export interface ChartOfAccountsInitializedEventPayload extends IAuditLog {
  readonly clinicId: string;
  readonly organizationId: string;
  /** Bu çalıştırmada fiilen eklenen hesap sayısı (zaten duranlar sayılmaz). */
  readonly createdCount: number;
  readonly createdCodes: readonly string[];
}

/**
 * Hesap planı kuruldu / eksik hesaplar tamamlandı.
 *
 * Tekil değil **toplu** bir olaydır: 65 hesap için 65 entity olayı üretmek yerine
 * (N+1 ve okunamaz denetim izi) Command Handler tek bir olay yayınlar —
 * CLAUDE.md'deki toplu-işlem istisnası.
 */
export class ChartOfAccountsInitializedEvent extends BaseEvent {
  static readonly NAME = CHART_OF_ACCOUNTS_EVENTS.INITIALIZED;

  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly createdCount: number;
  public readonly createdCodes: readonly string[];

  constructor(payload: ChartOfAccountsInitializedEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.createdCount = payload.createdCount;
    this.createdCodes = payload.createdCodes;
  }
}
