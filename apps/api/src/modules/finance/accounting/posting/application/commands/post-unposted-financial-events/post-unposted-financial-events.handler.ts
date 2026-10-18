import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { PaginationSchema } from '@shared';
import { GetUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-unposted-financial-events/get-unposted-financial-events.query';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import {
  PostUnpostedFinancialEventsCommand,
  PostUnpostedFinancialEventsResult,
} from './post-unposted-financial-events.command';

/** Tek çağrıda işlenecek en fazla olay (kuyruk/istek zaman aşımına karşı). */
const MAX_EVENTS_PER_RUN = 1000;
const PAGE_SIZE = 100;

@CommandHandler(PostUnpostedFinancialEventsCommand)
export class PostUnpostedFinancialEventsHandler implements ICommandHandler<
  PostUnpostedFinancialEventsCommand,
  PostUnpostedFinancialEventsResult
> {
  private readonly logger = new Logger(PostUnpostedFinancialEventsHandler.name);

  constructor(
    private readonly queryBus: TSQueryBus,
    private readonly commandBus: TSCommandBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: PostUnpostedFinancialEventsCommand
  ): Promise<PostUnpostedFinancialEventsResult> {
    const { clinicId, from, to, ctx } = command.payload;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(clinicId))
      .orThrow(ACCOUNTING_EVENTS.POST_UNPOSTED_FINANCIAL_EVENTS);

    const result: PostUnpostedFinancialEventsResult = {
      posted: 0,
      skipped: 0,
      failed: 0,
    };

    // Hep ilk sayfa çekilir: fişlenen olay filtreden düştüğü için offset kaydırmak
    // kayıt atlatırdı. Tur içinde hiç ilerleme olmazsa (hepsi kalıcı hata) durulur.
    for (let page = 0; page < MAX_EVENTS_PER_RUN / PAGE_SIZE; page++) {
      const { data: events } = await this.queryBus.execute(
        new GetUnpostedFinancialEventsQuery({
          filter: { clinicId, from, to, types: POSTABLE_FINANCIAL_EVENT_TYPES },
          pagination: PaginationSchema.parse({
            limit: PAGE_SIZE,
            page: 1,
            orderBy: 'asc',
            orderByColumn: 'occurredAt',
          }),
          ctx,
        })
      );

      if (events.length === 0) break;

      let progressed = false;
      for (const event of events) {
        try {
          const entryId = await this.commandBus.execute(
            new PostFinancialEventCommand(event.id, ctx)
          );
          if (entryId) {
            result.posted += 1;
          } else {
            // Posting kuralı olmayan olay tipi: bu olay hiç fişlenmeyecek;
            // sonsuz dönmemek için ilerleme sayılmaz ama hata da değildir.
            result.skipped += 1;
          }
          progressed = entryId !== null || progressed;
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `Backfill fiş üretemedi: event=${event.id}`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // Bu turda hiçbir olay fişlenemediyse (hepsi kural-yok ya da kalıcı hata)
      // aynı sayfa sonsuza kadar dönerdi.
      if (!progressed) break;
    }

    this.logger.log(
      `Backfill tamamlandı: fişlenen=${result.posted} atlanan=${result.skipped} hata=${result.failed}`
    );

    return result;
  }
}
