/* eslint-disable */
import { PeriodNotOpenForPostingException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { JournalEntryNotPostedException } from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { ReverseJournalEntryHandler } from './reverse-journal-entry.handler';
import { ReverseJournalEntryCommand } from './reverse-journal-entry.command';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { IJournalCommandRepository } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { AccountingPeriodStatusSchema } from '@shared';
import { IJournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';

describe('ReverseJournalEntryHandler (storno, doc 04/08)', () => {
  // createDraft yalnız `id`'yi UUID doğrular (clinicId/organizationId/periodId/accountId ham kalır).
  const ORIG_ID = '33333333-3333-4333-8333-333333333333';

  const ctx = {
    actor: { userId: 'user-1', clinicId: 'clinic-1', organizationId: 'org-1' },
  } as never;

  /** POSTED orijinal fiş: B 100 Kasa / A 600 Yurtiçi Satışlar = 1000. */
  const buildPostedOriginal = () => {
    const entry = JournalEntry.createDraft({
      id: ORIG_ID,
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      periodId: 'period-2025',
      entryDate: new Date('2025-12-31'),
      description: 'Tahsilat',
      lines: [
        { accountId: 'acc-100', debit: '1000' },
        { accountId: 'acc-600', credit: '1000' },
      ],
    });
    // Yevmiye sıra no VO en az 3 karakter ister (>= 100).
    entry.post(100n);
    return entry;
  };

  const build = (params: {
    original: JournalEntry | null;
    canPost?: boolean;
  }) => {
    const period = {
      id: 'period-2026',
      year: 2026,
      status:
        params.canPost === false
          ? AccountingPeriodStatusSchema.enum.LOCKED
          : AccountingPeriodStatusSchema.enum.OPEN,
    };

    const journalCommandRepo = {
      // Storno okuması kilitli: handler orijinali Command Repo'dan çeker.
      findByIdForUpdate: jest.fn().mockResolvedValue(params.original),
      create: jest.fn(async (entry: JournalEntry) => entry),
      update: jest.fn(async (entry: JournalEntry) => entry),
      applyReversal: jest.fn().mockResolvedValue(undefined),
    } as unknown as IJournalCommandRepository;

    // Numara artık dönem satırındaki sayaçtan, kilit altında tahsis edilir.
    const entryNumbering = {
      lockAndAllocateEntryNo: jest.fn().mockResolvedValue(107n),
      lockAndAllocateClosingEntryNo: jest.fn(),
    } as unknown as IJournalEntryNumberingService;

    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: period }),
    } as unknown as TSQueryBus;

    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    // Yetki kapıda: kapsam kaydın kendi kliniğinden doğrulanıyor.
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: () => ({ orThrow: () => undefined }) },
      }),
    } as never;

    return {
      handler: new ReverseJournalEntryHandler(
        journalCommandRepo,
        entryNumbering,
        queryBus,
        txManager,
        policyFactory
      ),
      journalCommandRepo,
      entryNumbering,
    };
  };

  const run = (handler: ReverseJournalEntryHandler) =>
    handler.execute(
      new ReverseJournalEntryCommand({
        entryId: ORIG_ID,
        ctx,
        reason: 'Hatalı kayıt',
      })
    );

  it('storno fişinde borç/alacak ters çevrilir, orijinal REVERSED bağlanır', async () => {
    const original = buildPostedOriginal();
    const { handler, journalCommandRepo } = build({ original });

    const reversalId = await run(handler);

    // update'e geçen storno fişi: satırlar ters (acc-100 alacak, acc-600 borç).
    const saved = (journalCommandRepo.create as jest.Mock).mock
      .calls[0][0] as JournalEntry;
    const lines = saved.lines.items;
    const kasa = lines.find((l) => l.accountId === 'acc-100')!;
    const satis = lines.find((l) => l.accountId === 'acc-600')!;
    expect(kasa.credit.toString()).toBe('1000');
    expect(kasa.debit.toString()).toBe('0');
    expect(satis.debit.toString()).toBe('1000');
    expect(satis.credit.toString()).toBe('0');
    expect(saved.isPosted()).toBe(true);

    // Orijinal REVERSED + storno fişine bağlandı.
    expect(original.isReversed()).toBe(true);
    expect(original.reversedById).toBe(reversalId);
    expect(journalCommandRepo.applyReversal).toHaveBeenCalledWith(original);
  });

  it('dönem kilitliyse storno atılamaz (update çağrılmaz)', async () => {
    const original = buildPostedOriginal();
    const { handler, journalCommandRepo } = build({ original, canPost: false });

    await expect(run(handler)).rejects.toBeInstanceOf(PeriodNotOpenForPostingException);
    expect(journalCommandRepo.create).not.toHaveBeenCalled();
  });

  it('yevmiye numarası dönem sayacından tahsis edilir (MAX+1 değil)', async () => {
    const original = buildPostedOriginal();
    const { handler, entryNumbering } = build({ original });

    await run(handler);

    expect(entryNumbering.lockAndAllocateEntryNo).toHaveBeenCalledWith(
      'period-2026'
    );
  });

  it('POSTED olmayan fiş storno edilemez', async () => {
    const draft = JournalEntry.createDraft({
      id: ORIG_ID,
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      periodId: 'period-2026',
      entryDate: new Date('2026-01-10'),
      lines: [
        { accountId: 'acc-100', debit: '1000' },
        { accountId: 'acc-600', credit: '1000' },
      ],
    });
    const { handler, journalCommandRepo } = build({ original: draft });

    await expect(run(handler)).rejects.toBeInstanceOf(JournalEntryNotPostedException);
    expect(journalCommandRepo.create).not.toHaveBeenCalled();
  });
});
