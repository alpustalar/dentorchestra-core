import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { JournalEntryNotFoundException } from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import {
  NoAccountingPeriodForDateException,
  PeriodNotOpenForPostingException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindPeriodByDateQuery } from '@modules/finance/accounting/periods/application/queries/find-period-by-date/find-period-by-date.query';
import {
  IJournalCommandRepository,
  JOURNAL_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { ReverseJournalEntryCommand } from './reverse-journal-entry.command';
import { AccountingPeriodStatusSchema } from '@shared';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IJournalEntryNumberingService,
  JOURNAL_ENTRY_NUMBERING_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';

@CommandHandler(ReverseJournalEntryCommand)
export class ReverseJournalEntryHandler
  implements ICommandHandler<ReverseJournalEntryCommand, string>
{
  constructor(
    @Inject(JOURNAL_COMMAND_REPOSITORY)
    private readonly journalCommandRepo: IJournalCommandRepository,
    @Inject(JOURNAL_ENTRY_NUMBERING_SERVICE)
    private readonly entryNumbering: IJournalEntryNumberingService,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: ReverseJournalEntryCommand): Promise<string> {
    const { entryId, ctx, reason } = command.payload;

    const entryDate = DateTimeManager.create();

    // Storno fişi + orijinalin REVERSED linkajı atomik (kritik finansal mutasyon).
    // Orijinal fiş kilitli okunur: `ensureReversible` yalnız kendi kopyasını korur,
    // kilit olmadan iki eşzamanlı istek aynı POSTED fişe iki ters kayıt üretebilirdi.
    return this.txManager.outboxRun(async () => {
      const original = await this.journalCommandRepo.findByIdForUpdate(entryId);
      if (!original) {
        throw new JournalEntryNotFoundException(entryId);
      }

      // `entryId` istekten geliyor; kapsam FİŞİN kendi kliniğinden doğrulanır.
      // Kontrol yokken storno yetkisi olan personel başka bir kliniğin fişini
      // ters kaydedip o defteri bozabiliyordu.
      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) => p.actorCanManageTargetClinic(original.clinicId))
        .orThrow(ACCOUNTING_EVENTS.JOURNAL_REVERSE);

      // Storno bugünün açık dönemine girer; kilitli dönemdeki orijinal kayda dokunulmaz.
      const { data: period } = await this.queryBus.execute(
        new FindPeriodByDateQuery(original.clinicId, entryDate, ctx)
      );
      if (!period) {
        throw new NoAccountingPeriodForDateException(entryDate);
      }
      if (period.status !== AccountingPeriodStatusSchema.enum.OPEN) {
        throw new PeriodNotOpenForPostingException(period.year, period.status);
      }

      const generatedReversalUUID = UUID.generate();
      // buildReversalDraft + markReversed aynı invariant'ı (POSTED + henüz storno yok) korur.
      const reversal = original.buildReversalDraft({
        reversalId: generatedReversalUUID.value,
        periodId: period.id,
        entryDate,
        description: reason,
        performedById: ctx.actor.userId,
      });
      original.markReversed({
        reversalId: generatedReversalUUID.value,
        actorId: ctx.actor.userId,
        reason,
        source: ctx.actor.source,
      });

      // Numara dönem satırındaki sayaçtan, kilit altında (aynı tx): iki eşzamanlı
      // storno aynı numarayı alamaz ve dönem bu arada kapanmışsa tahsis reddedilir.
      const entryNo = await this.entryNumbering.lockAndAllocateEntryNo(
        period.id
      );
      reversal.post(entryNo);
      const saved = await this.journalCommandRepo.create(reversal);
      await this.journalCommandRepo.applyReversal(original);
      return saved.id;
    });
  }
}
