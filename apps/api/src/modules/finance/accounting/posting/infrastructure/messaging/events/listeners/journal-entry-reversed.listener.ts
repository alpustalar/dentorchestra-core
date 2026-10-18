import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { JournalEntryReversedEvent } from '@modules/finance/accounting/posting/domain/events';
import { OnDomainEvent } from '@common/decorators';

/**
 * Storno denetim izi. Fişin kendisi append-only olduğu için "kim iptal etti"
 * sorusunun kalıcı yanıtı iki yerdedir: storno fişinin `performedById` kolonu ve
 * bu olayın audit log kaydı. İkincisi olmadan, defteri düzelten elin izi yalnız
 * yeni fişin içinde gömülü kalırdı — denetimde aranabilir bir kayıt olmazdı.
 */
@Injectable()
export class JournalEntryReversedListener {
  private readonly logger = new Logger(JournalEntryReversedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(JournalEntryReversedEvent.NAME)
  async handle(event: JournalEntryReversedEvent): Promise<void> {
    const {
      log,
      metadata,
      entryId,
      reversalId,
      clinicId,
      organizationId,
      periodId,
      entryNo,
      reason,
    } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: {
          entryId,
          reversalId,
          clinicId,
          organizationId,
          periodId,
          entryNo,
          reason,
        },
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
      this.logger.error('Yevmiye storno audit log hatası', err);
    }
  }
}
