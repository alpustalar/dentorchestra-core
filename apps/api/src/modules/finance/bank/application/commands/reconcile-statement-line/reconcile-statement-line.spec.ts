/*
 * Repo/politika taklitleri tiplenmemiş (`any`) nesneler taşır; kurallar yalnız
 * bu dosyada kapatılır (üretim kodunda açık kalır).
 */

import { ReconcileStatementLineHandler } from './reconcile-statement-line.handler';
import { ReconcileStatementLineCommand } from './reconcile-statement-line.command';
import { BankStatementLineMatchRefAlreadyUsedException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import BankStatementLineMatchStatusSchema from '@input-type-schemas/BankStatementLineMatchStatusSchema';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Aynı defter hareketinin iki ekstre satırına bağlanması mutabakat özetini
 * bozar: hareket iki kez "mutabık" sayılır, gerçekten mutabık olmayan bir
 * hareket gizlenir. Oto-eşleştirme bunu engelliyordu; elle mutabakatta kontrol
 * yoktu.
 */
describe('ReconcileStatementLineHandler', () => {
  const ctx = {
    actor: { userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h', source: LogSource.WEB },
    source: 'API',
  } as never;

  const make = (options: {
    currentRef?: string | null;
    usedRefs?: string[];
  }) => {
    const line = {
      clinicId: { value: 'clinic-1' },
      matchedRef: options.currentRef ?? null,
      reconcile: jest.fn(),
    };
    const bankStatementLineRepo = {
      findByIdForUpdate: jest.fn().mockResolvedValue(line),
      findUsedMatchRefs: jest.fn().mockResolvedValue(options.usedRefs ?? []),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const policyFactory = {
      finance: () => ({
        evaluator: { check: () => ({ orThrow: jest.fn() }) },
      }),
    };
    const txManager = {
      run: jest.fn().mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    const handler = new ReconcileStatementLineHandler(
      bankStatementLineRepo as never,
      policyFactory as never,
      txManager as never
    );
    return { handler, line, bankStatementLineRepo };
  };

  const run = (
    handler: ReconcileStatementLineHandler,
    data: {
      matchStatus: (typeof BankStatementLineMatchStatusSchema.enum)[keyof typeof BankStatementLineMatchStatusSchema.enum];
      matchedRef?: string | null;
    }
  ) =>
    handler.execute(
      new ReconcileStatementLineCommand({
        lineId: 'line-1',
        data: data as never,
        ctx,
      })
    );

  it('serbest bir defter hareketine elle eşleştirir', async () => {
    const { handler, line, bankStatementLineRepo } = make({});

    await run(handler, {
      matchStatus: BankStatementLineMatchStatusSchema.enum.MATCHED,
      matchedRef: 'journal-line-1',
    });

    expect(line.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ matchedRef: 'journal-line-1' })
    );
    expect(bankStatementLineRepo.update).toHaveBeenCalledTimes(1);
  });

  it('başka satırın kullandığı defter hareketine eşleştirmeyi reddeder', async () => {
    const { handler, line, bankStatementLineRepo } = make({
      usedRefs: ['journal-line-1'],
    });

    await expect(
      run(handler, {
        matchStatus: BankStatementLineMatchStatusSchema.enum.MATCHED,
        matchedRef: 'journal-line-1',
      })
    ).rejects.toThrow(BankStatementLineMatchRefAlreadyUsedException);

    expect(line.reconcile).not.toHaveBeenCalled();
    expect(bankStatementLineRepo.update).not.toHaveBeenCalled();
  });

  it('satırın KENDİ referansını yeniden yazmak serbesttir (not düzeltme)', async () => {
    const { handler, line } = make({
      currentRef: 'journal-line-1',
      usedRefs: ['journal-line-1'],
    });

    await run(handler, {
      matchStatus: BankStatementLineMatchStatusSchema.enum.MATCHED,
      matchedRef: 'journal-line-1',
    });

    expect(line.reconcile).toHaveBeenCalledTimes(1);
  });

  it('IGNORED / UNMATCHED geçişlerinde referans kontrolü yapılmaz', async () => {
    const { handler, bankStatementLineRepo } = make({});

    await run(handler, {
      matchStatus: BankStatementLineMatchStatusSchema.enum.IGNORED,
    });

    expect(bankStatementLineRepo.findUsedMatchRefs).not.toHaveBeenCalled();
  });
});
