import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { GetClinicsWithUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-clinics-with-unposted-financial-events/get-clinics-with-unposted-financial-events.query';
import { PostUnpostedFinancialEventsCommand } from '@modules/finance/accounting/posting/application/commands/post-unposted-financial-events/post-unposted-financial-events.command';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import {
  SweepUnpostedFinancialEventsCommand,
  SweepUnpostedFinancialEventsResult,
} from './sweep-unposted-financial-events.command';

/**
 * Pencere neden 45 gün: taramanın maliyeti pencereyle büyür, faydası ise
 * pencerenin bir kapanış çevrimini (ay sonu + mutabakat) kapsamasıyla doyar.
 * Daha eski boşluklar zaten dönem kapanışı kapısında (P0-4) yakalanıyor;
 * günlük iş **yeni** boşluğu hızla görmek içindir.
 */
const DEFAULT_LOOKBACK_DAYS = 45;

@CommandHandler(SweepUnpostedFinancialEventsCommand)
export class SweepUnpostedFinancialEventsHandler implements ICommandHandler<
  SweepUnpostedFinancialEventsCommand,
  SweepUnpostedFinancialEventsResult
> {
  private readonly logger = new Logger(
    SweepUnpostedFinancialEventsHandler.name
  );

  constructor(
    private readonly queryBus: TSQueryBus,
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(
    command: SweepUnpostedFinancialEventsCommand
  ): Promise<SweepUnpostedFinancialEventsResult> {
    const ctx = ExecutionContextFactory.createInternal();
    const to = DateTimeManager.create();
    const from = DateTimeManager.subtractDays(
      to,
      command.payload.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
    );

    const { data: clinicIds } = await this.queryBus.execute(
      new GetClinicsWithUnpostedFinancialEventsQuery({
        filter: { from, to, types: POSTABLE_FINANCIAL_EVENT_TYPES },
        ctx,
      })
    );

    const result: SweepUnpostedFinancialEventsResult = {
      clinics: clinicIds.length,
      posted: 0,
      skipped: 0,
      failed: 0,
    };

    if (clinicIds.length === 0) return result;

    // Klinik başına ayrı çağrı: bir defterin kalıcı hatası (ör. hesap planı
    // eksik) diğer defterlerin fişlerini üretmesini engellemez.
    for (const clinicId of clinicIds) {
      try {
        const clinicResult = await this.commandBus.execute(
          new PostUnpostedFinancialEventsCommand({ clinicId, from, to, ctx })
        );
        result.posted += clinicResult.posted;
        result.skipped += clinicResult.skipped;
        result.failed += clinicResult.failed;
      } catch (error) {
        result.failed += 1;
        this.criticalFailure.publish({
          operation: 'accounting.posting.sweep-unposted-financial-events',
          severity: 'CRITICAL',
          summary:
            'Fişlenmemiş ekonomik olay süpürmesi bir defter için çalışamadı.',
          errorMessage: error instanceof Error ? error.message : String(error),
          context: { clinicId },
          clinicId,
          dedupeKey: `posting-sweep-failed:${clinicId}`,
        });
      }
    }

    // Süpürme sonunda hâlâ fişlenemeyen olay varsa bu kalıcı bir hatadır: uyarı
    // olmadan, mizan eksikliği yalnız yıl sonunda görünür hale gelirdi.
    if (result.failed > 0) {
      this.criticalFailure.publish({
        operation: 'accounting.posting.sweep-unposted-financial-events',
        severity: 'CRITICAL',
        summary:
          'Fişlenmemiş ekonomik olaylar süpürmeden sonra da fişlenemedi (kalıcı hata).',
        errorMessage: `başarısız=${result.failed} defter=${result.clinics}`,
        context: {
          clinics: result.clinics,
          posted: result.posted,
          failed: result.failed,
        },
        clinicId: null,
        dedupeKey: 'posting-sweep-residual-failures',
      });
    }

    this.logger.log(
      `Süpürme tamamlandı: defter=${result.clinics} fişlenen=${result.posted} ` +
        `atlanan=${result.skipped} hata=${result.failed}`
    );

    return result;
  }
}
