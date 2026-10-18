/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { FindLedgerMismatchesHandler } from './find-ledger-mismatches.handler';
import { FindLedgerMismatchesQuery } from './find-ledger-mismatches.query';
import { FindSettledInstallmentsQuery } from '@modules/finance/payment/application/queries/find-settled-installments/find-settled-installments.query';
import { InstallmentStatusSchema, LedgerStatusSchema } from '@shared';
import type { InstallmentStatusType } from '@input-type-schemas/InstallmentStatusSchema';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';

/**
 * Mutabakat: kaynak (taksit) ↔ cari defter. Bu sorgu olmadan yutulan/ölen
 * kayıt işi yalnız BullMQ'nun failed set'inde görünüyordu.
 */
describe('FindLedgerMismatchesHandler', () => {
  const clinicId = randomUUID();
  const ctx = {} as never;
  const filter = {
    clinicId,
    from: new Date('2026-09-01'),
    to: new Date('2026-09-30'),
  };

  const settled = (installmentId: string, status: InstallmentStatusType) => ({
    installmentId,
    paymentId: randomUUID(),
    clinicId,
    patientId: randomUUID(),
    amount: new Decimal('250.00'),
    currency: 'TRY' as const,
    status,
    settledAt: new Date('2026-09-15'),
  });

  const make = (
    rows: ReturnType<typeof settled>[],
    ledgerRows: Array<{ installmentId: string; status: LedgerStatusType }>
  ) => {
    const queryBus = {
      execute: jest.fn(async (q: unknown) => {
        if (q instanceof FindSettledInstallmentsQuery) return { data: rows };
        return { data: [] };
      }),
    };
    const ledgerQueryRepo = {
      findEntryStatusesByInstallmentIds: jest.fn(async () => ledgerRows),
    };

    return {
      handler: new FindLedgerMismatchesHandler(
        ledgerQueryRepo as never,
        queryBus as never
      ),
      ledgerQueryRepo,
    };
  };

  it('cari kaydı hiç yazılmamış tahsilatı MISSING olarak döner', async () => {
    const id = randomUUID();
    const { handler } = make(
      [settled(id, InstallmentStatusSchema.enum.COMPLETED)],
      []
    );

    const { data } = await handler.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );

    expect(data).toHaveLength(1);
    expect(data[0].kind).toBe('MISSING');
    expect(data[0].ledgerStatus).toBeNull();
    expect(data[0].expectedStatus).toBe(LedgerStatusSchema.enum.COMPLETED);
  });

  it('iade yapılmış ama defterde tahsilat görünen kaydı STATUS_DRIFT döner', async () => {
    const id = randomUUID();
    const { handler } = make(
      [settled(id, InstallmentStatusSchema.enum.REFUNDED)],
      [{ installmentId: id, status: LedgerStatusSchema.enum.COMPLETED }]
    );

    const { data } = await handler.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );

    expect(data).toHaveLength(1);
    expect(data[0].kind).toBe('STATUS_DRIFT');
    expect(data[0].ledgerStatus).toBe(LedgerStatusSchema.enum.COMPLETED);
    expect(data[0].expectedStatus).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('durumlar uyuşuyorsa fark döndürmez', async () => {
    const id = randomUUID();
    const { handler } = make(
      [settled(id, InstallmentStatusSchema.enum.COMPLETED)],
      [{ installmentId: id, status: LedgerStatusSchema.enum.COMPLETED }]
    );

    const { data } = await handler.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );

    expect(data).toEqual([]);
  });

  it('aralıkta sonuçlanmış taksit yoksa deftere hiç gitmez', async () => {
    const { handler, ledgerQueryRepo } = make([], []);

    const { data } = await handler.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );

    expect(data).toEqual([]);
    expect(
      ledgerQueryRepo.findEntryStatusesByInstallmentIds
    ).not.toHaveBeenCalled();
  });
});
