/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır. Kural YALNIZ bu dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { ReverseJournalEntryByEventHandler } from './reverse-journal-entry-by-event.handler';
import { ReverseJournalEntryByEventCommand } from './reverse-journal-entry-by-event.command';
import { ReverseJournalEntryCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry/reverse-journal-entry.command';
import {
  FinancialEventNotFoundForPostingException,
  FinancialEventNotPostedYetException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Belge iptalinin muhasebe bacağı: `dedupeKey` → FinancialEvent → fiş zinciri.
 *
 * Kritik davranış, olayın **fişlenmemiş** olduğu pencerede iptali REDDETMEK:
 * izin verilseydi belge CANCELLED olurken fiş birkaç saniye sonra üretilir ve
 * iptal edilmiş belgenin hasılatı defterde kalıcı olarak kalırdı.
 */
describe('ReverseJournalEntryByEventHandler', () => {
  const ctx = {
    actor: { userId: 'firebase-uid-1', source: LogSource.WEB },
    source: 'USER_ACTION',
  } as never;

  const eventId = UUID.generate().value;
  const entryId = UUID.generate().value;
  const dedupeKey = `sales-invoice:${UUID.generate().value}`;

  const make = (options: {
    event?: { id: { value: string } } | null;
    entry?: { id: string } | null;
  }) => {
    const financialEventRepo = {
      findByDedupeKey: jest.fn(async () =>
        options.event === undefined ? { id: { value: eventId } } : options.event
      ),
      appendIfAbsent: jest.fn(),
      countUnpostedInRange: jest.fn(),
    };
    const journalCommandRepo = {
      findByEventId: jest.fn(async () =>
        options.entry === undefined ? { id: entryId } : options.entry
      ),
      create: jest.fn(),
      applyReversal: jest.fn(),
      findByIdForUpdate: jest.fn(),
      trialBalance: jest.fn(),
    };
    const commandBus = {
      execute: jest.fn(async (cmd: unknown) =>
        cmd instanceof ReverseJournalEntryCommand ? 'reversal-1' : undefined
      ),
    };

    const handler = new ReverseJournalEntryByEventHandler(
      financialEventRepo as never,
      journalCommandRepo as never,
      commandBus as never
    );

    return { handler, financialEventRepo, journalCommandRepo, commandBus };
  };

  const run = (handler: ReverseJournalEntryByEventHandler) =>
    handler.execute(
      new ReverseJournalEntryByEventCommand({
        dedupeKey,
        reason: 'Fatura iptali: tutar hatalı',
        ctx,
      })
    );

  it('olayın fişini bulur ve stornoyu entryId ile devreder', async () => {
    const { handler, financialEventRepo, journalCommandRepo, commandBus } =
      make({});

    await expect(run(handler)).resolves.toBe('reversal-1');

    expect(financialEventRepo.findByDedupeKey).toHaveBeenCalledWith(dedupeKey);
    expect(journalCommandRepo.findByEventId).toHaveBeenCalledWith(eventId);

    const [cmd] = commandBus.execute.mock.calls[0] as [unknown];
    expect(cmd).toBeInstanceOf(ReverseJournalEntryCommand);
    expect((cmd as ReverseJournalEntryCommand).payload.entryId).toBe(entryId);
    expect((cmd as ReverseJournalEntryCommand).payload.reason).toBe(
      'Fatura iptali: tutar hatalı'
    );
  });

  it('ekonomik olay yoksa hata fırlatır (belge defterle hiç köprülenmemiş)', async () => {
    const { handler, commandBus } = make({ event: null });

    await expect(run(handler)).rejects.toThrow(
      FinancialEventNotFoundForPostingException
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('olay henüz fişlenmediyse iptal reddedilir (storno atılmaz)', async () => {
    const { handler, commandBus } = make({ entry: null });

    await expect(run(handler)).rejects.toThrow(
      FinancialEventNotPostedYetException
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('okumalar Command Repo üzerinden yapılır (yazma kararı besliyor)', async () => {
    const { handler, financialEventRepo, journalCommandRepo } = make({});

    await run(handler);

    // Her iki okuma da kilit/transaction kapsamında olan Command Repo'dan.
    expect(financialEventRepo.findByDedupeKey).toHaveBeenCalledTimes(1);
    expect(journalCommandRepo.findByEventId).toHaveBeenCalledTimes(1);
  });
});
