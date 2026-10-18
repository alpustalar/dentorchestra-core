import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  FINANCIAL_EVENT_COMMAND_REPOSITORY,
  IFinancialEventCommandRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import {
  IJournalCommandRepository,
  JOURNAL_COMMAND_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import {
  FinancialEventNotFoundForPostingException,
  FinancialEventNotPostedYetException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { ReverseJournalEntryCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry/reverse-journal-entry.command';
import { ReverseJournalEntryByEventCommand } from './reverse-journal-entry-by-event.command';

/**
 * Belge iptalinin muhasebe bacağı. Kaynak belgeyi deftere bağlayan zincir:
 * `dedupeKey` → `FinancialEvent.id` → `JournalEntry.eventId` (unique).
 *
 * Okumalar **Command Repo'dan** yapılır: ikisi de bir yazma kararını (storno)
 * besliyor ve çağıranın transaction'ı içinde çalışıyor. Query Repo'dan okunsaydı
 * replica gecikmesinde "fiş yok" görülüp iptal gereksiz yere reddedilebilirdi.
 *
 * Yetki kontrolü ve kilit, devrettiği `ReverseJournalEntryCommand`'ın içindedir
 * (orijinal fiş `FOR UPDATE` ile okunur, `ensureReversible` mükerrer stornoyu
 * kapatır) — burada tekrarlanmaz.
 */
@CommandHandler(ReverseJournalEntryByEventCommand)
export class ReverseJournalEntryByEventHandler implements ICommandHandler<
  ReverseJournalEntryByEventCommand,
  string
> {
  constructor(
    @Inject(FINANCIAL_EVENT_COMMAND_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventCommandRepository,
    @Inject(JOURNAL_COMMAND_REPOSITORY)
    private readonly journalCommandRepo: IJournalCommandRepository,
    private readonly commandBus: TSCommandBus
  ) {}

  async execute(command: ReverseJournalEntryByEventCommand): Promise<string> {
    const { dedupeKey, reason, ctx } = command.payload;

    const event = await this.financialEventRepo.findByDedupeKey(dedupeKey);
    if (!event) {
      // Belgeyi yazan akış olayı **aynı transaction** içinde yazar; olay yoksa
      // belge ile defter arasında hiç köprü kurulmamış demektir. Sessizce "iptal
      // edildi" demek, deftere hiç düşmemiş bir belgeyi iptal etmiş gibi
      // göstermek olurdu — fark görünür kalmalı.
      throw new FinancialEventNotFoundForPostingException(dedupeKey);
    }

    const entry = await this.journalCommandRepo.findByEventId(event.id.value);
    if (!entry) {
      throw new FinancialEventNotPostedYetException({
        dedupeKey,
        financialEventId: event.id.value,
      });
    }

    return this.commandBus.execute(
      new ReverseJournalEntryCommand({ entryId: entry.id, ctx, reason })
    );
  }
}
