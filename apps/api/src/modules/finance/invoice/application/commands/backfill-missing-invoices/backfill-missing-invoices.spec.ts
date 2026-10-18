/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { Decimal } from 'decimal.js';
import { BackfillMissingInvoicesHandler } from './backfill-missing-invoices.handler';
import { BackfillMissingInvoicesCommand } from './backfill-missing-invoices.command';
import { FindUninvoicedPaymentsQuery } from '@modules/finance/invoice/application/queries/find-uninvoiced-payments/find-uninvoiced-payments.query';
import { IssueInvoiceCommand } from '@modules/finance/invoice/application/commands/issue-invoice/issue-invoice.command';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Yutulan fatura hatalarının telafi yolu (§12 P1-6). Mutabakat sorgusu eksikleri
 * bulur, bu komut onları yeniden faturalar; `IssueInvoiceCommand` idempotent
 * olduğu için tur tekrar tekrar çalıştırılabilir.
 */
describe('BackfillMissingInvoicesHandler', () => {
  const ctx = {
    actor: { userId: 'user-1', source: LogSource.WEB },
    source: 'USER_ACTION',
  } as never;

  const filter = {
    clinicId: 'clinic-1',
    from: new Date('2026-05-01'),
    to: new Date('2026-05-31'),
  };

  const row = (paymentId: string) => ({
    paymentId,
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    appointmentId: null,
    totalAmount: new Decimal('1000.00'),
    currency: 'TRY' as const,
    firstCollectedAt: new Date('2026-05-10'),
  });

  const make = (missing: ReturnType<typeof row>[]) => {
    const queryBus = {
      execute: jest.fn(async (q: unknown) => {
        if (q instanceof FindUninvoicedPaymentsQuery) return { data: missing };
        return { data: null };
      }),
    };
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const handler = new BackfillMissingInvoicesHandler(
      commandBus as never,
      queryBus as never
    );
    return { handler, commandBus, queryBus };
  };

  it('eksik her tahsilat için fatura komutu dispatch eder', async () => {
    const { handler, commandBus } = make([row('pay-1'), row('pay-2')]);

    const result = await handler.execute(
      new BackfillMissingInvoicesCommand({ filter, ctx })
    );

    expect(result).toEqual({ attempted: 2, issued: 2, failed: [] });

    const issued = commandBus.execute.mock.calls
      .map(([c]) => c)
      .filter(
        (c): c is IssueInvoiceCommand => c instanceof IssueInvoiceCommand
      );
    expect(issued).toHaveLength(2);
    expect(issued[0].input.paymentId).toBe('pay-1');
    // Tutar ödemenin toplamıdır (taksit değil) ve para birimi korunur.
    expect(issued[0].input.totalAmount.value.toFixed(2)).toBe('1000.00');
    expect(issued[0].input.totalAmount.currency).toBe('TRY');
  });

  it('eksik yoksa hiçbir şey dispatch etmez', async () => {
    const { handler, commandBus } = make([]);

    const result = await handler.execute(
      new BackfillMissingInvoicesCommand({ filter, ctx })
    );

    expect(result).toEqual({ attempted: 0, issued: 0, failed: [] });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('bir tahsilatın hatası turu durdurmaz; başarısızlar gerekçesiyle dönülür', async () => {
    const { handler, commandBus } = make([
      row('pay-1'),
      row('pay-2'),
      row('pay-3'),
    ]);
    commandBus.execute.mockImplementation(async (cmd: unknown) => {
      if (
        cmd instanceof IssueInvoiceCommand &&
        cmd.input.paymentId === 'pay-2'
      ) {
        throw new Error('vergi oranı çözülemedi');
      }
      return undefined;
    });

    const result = await handler.execute(
      new BackfillMissingInvoicesCommand({ filter, ctx })
    );

    expect(result.attempted).toBe(3);
    expect(result.issued).toBe(2);
    expect(result.failed).toEqual([
      { paymentId: 'pay-2', reason: 'vergi oranı çözülemedi' },
    ]);
  });
});
