import { Injectable, Logger } from '@nestjs/common';
import { FINANCIAL_EVENT_EVENTS } from '@src/domain/constants/events';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { FinancialEventRecordedEvent } from '@modules/finance/accounting/financial-events/domain/events/financial-event-recorded.event';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

/**
 * Bir ekonomik olay kaydedildiğinde fişi üretir.
 * Asenkron ve gevşek bağlı: olay defteri bozulmaz, posting hatası kaydı etkilemez.
 */
@Injectable()
export class FinancialEventRecordedListener {
  private readonly logger = new Logger(FinancialEventRecordedListener.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(FINANCIAL_EVENT_EVENTS.RECORDED)
  async handle(event: FinancialEventRecordedEvent): Promise<void> {
    const ctx = ExecutionContextFactory.createInternal();

    try {
      const entryId = await this.commandBus.execute(
        new PostFinancialEventCommand(event.financialEventId, ctx)
      );
      if (entryId) {
        this.logger.log(
          `Fiş üretildi: event=${event.financialEventId} entry=${entryId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Fiş üretilemedi: event=${event.financialEventId}`,
        error
      );
      // Ekonomik olay kaydedildi ama fişi atılmadı: mizan eksik kalır ve bunu
      // kimse fark etmez — hata burada bilerek yutuluyor (olay defteri bozulmasın).
      this.criticalFailure.publish({
        operation: 'accounting.posting.post-financial-event',
        severity: 'CRITICAL',
        summary: 'Ekonomik olay kaydedildi ancak yevmiye fişi üretilemedi.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          financialEventId: event.financialEventId,
          clinicId: event.clinicId,
          organizationId: event.organizationId,
          eventType: event.type,
        },
        // Defter sahibi şube: uyarının tek işi "hangi defterin mizanı eksik
        // kaldı" sorusunu cevaplamak; kiracısız bir alarm yönlendirilemez.
        clinicId: event.clinicId,
        dedupeKey: `posting-failed:${event.financialEventId}`,
      });
    }
  }
}
