/*
 * Bus/servis taklitleri tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { BackfillPosAccountingEventsHandler } from './backfill-pos-accounting-events.handler';
import { BackfillPosAccountingEventsCommand } from './backfill-pos-accounting-events.command';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Satış akışında muhasebe köprüsü hatası **yutulur** (kart çekildi, geri sarmak
 * defteri bozardı) ve olay hiç yazılmadığı için `sweep-unposted-financial-events`
 * onu göremez. CLAUDE.md finans kuralı 4 bu yüzden telafi yolunu zorunlu kılar.
 */
describe('BackfillPosAccountingEventsHandler', () => {
  const ctx = {
    actor: { userId: 'u1', source: LogSource.WEB },
    source: 'API',
  } as never;

  const data = {
    clinicId: 'clinic-1',
    from: new Date('2026-05-01'),
    to: new Date('2026-05-31'),
  };

  const row = (id: string) => ({
    posTransactionId: id,
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    amount: '1000.00',
    currency: 'TRY',
    completedAt: new Date('2026-05-10'),
  });

  const make = (missing: ReturnType<typeof row>[]) => {
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: missing }),
    };
    const accountingBridge = { record: jest.fn().mockResolvedValue(undefined) };
    const policyFactory = {
      finance: () => ({
        evaluator: { check: () => ({ orThrow: jest.fn() }) },
      }),
    };
    const handler = new BackfillPosAccountingEventsHandler(
      queryBus as never,
      accountingBridge as never,
      policyFactory as never
    );
    return { handler, accountingBridge };
  };

  it('köprüsü kurulmamış her tahsilat için olayı yazar', async () => {
    const { handler, accountingBridge } = make([row('tx-1'), row('tx-2')]);

    const result = await handler.execute(
      new BackfillPosAccountingEventsCommand({ data, ctx })
    );

    expect(result).toEqual({ attempted: 2, recorded: 2, failed: [] });
    expect(accountingBridge.record).toHaveBeenCalledTimes(2);
    // Tutar Decimal'e çevrilerek geçer (string aritmetiği yok).
    expect(accountingBridge.record.mock.calls[0][0].amount.toFixed(2)).toBe(
      '1000.00'
    );
  });

  it('eksik yoksa hiçbir şey yazmaz', async () => {
    const { handler, accountingBridge } = make([]);

    const result = await handler.execute(
      new BackfillPosAccountingEventsCommand({ data, ctx })
    );

    expect(result).toEqual({ attempted: 0, recorded: 0, failed: [] });
    expect(accountingBridge.record).not.toHaveBeenCalled();
  });

  it('bir tahsilatın hatası turu durdurmaz; başarısızlar gerekçesiyle dönülür', async () => {
    const { handler, accountingBridge } = make([
      row('tx-1'),
      row('tx-2'),
      row('tx-3'),
    ]);
    accountingBridge.record.mockImplementation(
      (input: { posTransactionId: string }) => {
        if (input.posTransactionId === 'tx-2') {
          return Promise.reject(new Error('cari açılamadı'));
        }
        return Promise.resolve(undefined);
      }
    );

    const result = await handler.execute(
      new BackfillPosAccountingEventsCommand({ data, ctx })
    );

    expect(result.attempted).toBe(3);
    expect(result.recorded).toBe(2);
    expect(result.failed).toEqual([
      { posTransactionId: 'tx-2', reason: 'cari açılamadı' },
    ]);
  });
});
