/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { BackfillLedgerEntriesHandler } from './backfill-ledger-entries.handler';
import { BackfillLedgerEntriesCommand } from './backfill-ledger-entries.command';
import { FindLedgerMismatchesQuery } from '@modules/finance/finance-ledger/application/queries/find-ledger-mismatches/find-ledger-mismatches.query';
import { SyncInstallmentLedgerEntryCommand } from '@modules/finance/finance-ledger/application/commands/sync-installment-ledger-entry/sync-installment-ledger-entry.command';
import { LedgerStatusSchema } from '@shared';
import type { LedgerMismatchRow } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';

/**
 * Telafi turu (CLAUDE.md finans kuralı 4): eksikler sorgusu + onarım komutu.
 * Tek bir satırın hatası turu durdurmaz.
 */
describe('BackfillLedgerEntriesHandler', () => {
  const clinicId = randomUUID();
  const ctx = { actor: { userId: 'uid-1' } } as never;
  const filter = {
    clinicId,
    from: new Date('2026-09-01'),
    to: new Date('2026-09-30'),
  };

  const mismatch = (
    installmentId: string,
    kind: LedgerMismatchRow['kind']
  ): LedgerMismatchRow => ({
    installmentId,
    paymentId: randomUUID(),
    clinicId,
    patientId: randomUUID(),
    amount: new Decimal('100.00'),
    currency: 'TRY',
    expectedStatus: LedgerStatusSchema.enum.COMPLETED,
    ledgerStatus: kind === 'MISSING' ? null : LedgerStatusSchema.enum.REFUNDED,
    kind,
    settledAt: new Date('2026-09-10'),
  });

  const make = (
    rows: LedgerMismatchRow[],
    outcomes: Record<string, 'RECORDED' | 'SYNCED' | Error> = {}
  ) => {
    const queryBus = {
      execute: jest.fn(async (q: unknown) => {
        if (q instanceof FindLedgerMismatchesQuery) return { data: rows };
        return { data: [] };
      }),
    };
    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        if (cmd instanceof SyncInstallmentLedgerEntryCommand) {
          const outcome = outcomes[cmd.payload.installmentId] ?? 'RECORDED';
          if (outcome instanceof Error) throw outcome;
          return { outcome };
        }
        return undefined;
      }),
    };

    return {
      handler: new BackfillLedgerEntriesHandler(
        commandBus as never,
        queryBus as never
      ),
      commandBus,
    };
  };

  it('eksik her kayıt için onarım komutu dispatch eder', async () => {
    const a = randomUUID();
    const b = randomUUID();
    const { handler, commandBus } = make(
      [mismatch(a, 'MISSING'), mismatch(b, 'STATUS_DRIFT')],
      { [b]: 'SYNCED' }
    );

    const result = await handler.execute(
      new BackfillLedgerEntriesCommand({ filter, ctx })
    );

    expect(result).toEqual({
      attempted: 2,
      recorded: 1,
      synced: 1,
      failed: [],
    });
    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });

  it('fark yoksa hiçbir şey dispatch etmez', async () => {
    const { handler, commandBus } = make([]);

    const result = await handler.execute(
      new BackfillLedgerEntriesCommand({ filter, ctx })
    );

    expect(result).toEqual({
      attempted: 0,
      recorded: 0,
      synced: 0,
      failed: [],
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('bir kaydın hatası turu durdurmaz; başarısızlar gerekçesiyle dönülür', async () => {
    const a = randomUUID();
    const b = randomUUID();
    const c = randomUUID();
    const { handler } = make(
      [mismatch(a, 'MISSING'), mismatch(b, 'MISSING'), mismatch(c, 'MISSING')],
      { [b]: new Error('taksit bulunamadı') }
    );

    const result = await handler.execute(
      new BackfillLedgerEntriesCommand({ filter, ctx })
    );

    expect(result.attempted).toBe(3);
    expect(result.recorded).toBe(2);
    expect(result.failed).toEqual([
      { installmentId: b, reason: 'taksit bulunamadı' },
    ]);
  });
});
