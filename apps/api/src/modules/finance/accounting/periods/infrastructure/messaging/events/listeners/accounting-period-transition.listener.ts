import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import {
  AccountingPeriodClosedEvent,
  AccountingPeriodLockedEvent,
  AccountingPeriodOpenedEvent,
  AccountingPeriodReopenedEvent,
} from '@modules/finance/accounting/periods/domain/events';
import { OnDomainEvent } from '@common/decorators';

type AccountingPeriodTransitionEvent =
  | AccountingPeriodOpenedEvent
  | AccountingPeriodLockedEvent
  | AccountingPeriodReopenedEvent
  | AccountingPeriodClosedEvent;

/**
 * Dönem durum geçişlerinin denetim izi. Mali yılın kapatılması/kilidin açılması
 * finans modülünün en yüksek etkili işlemidir: "kim, ne zaman" sorusu hem kaydın
 * damga kolonlarında hem burada, audit log'da yanıtlanır.
 *
 * Dört geçiş aynı gövdeyi taşıdığı için tek handler dört olayı dinler.
 */
@Injectable()
export class AccountingPeriodTransitionListener {
  private readonly logger = new Logger(AccountingPeriodTransitionListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(AccountingPeriodOpenedEvent.NAME)
  @OnDomainEvent(AccountingPeriodLockedEvent.NAME)
  @OnDomainEvent(AccountingPeriodReopenedEvent.NAME)
  @OnDomainEvent(AccountingPeriodClosedEvent.NAME)
  async handle(event: AccountingPeriodTransitionEvent): Promise<void> {
    const { log, metadata, periodId, clinicId, organizationId, year } = event;
    try {
      if (!log) return;
      const { action, source, actorId, type } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: { periodId, clinicId, organizationId, year },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      };

      if (type === LogType.SECURITY) {
        await this.auditLogService.security(logInput);
        return;
      }
      await this.auditLogService.info(logInput);
    } catch (err) {
      this.logger.error('Muhasebe dönemi audit log hatası', err);
    }
  }
}
