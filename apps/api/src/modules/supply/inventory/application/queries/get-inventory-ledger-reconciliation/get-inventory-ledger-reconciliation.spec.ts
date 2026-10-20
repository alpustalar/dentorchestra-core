import { GetInventoryLedgerReconciliationHandler } from './get-inventory-ledger-reconciliation.handler';
import { GetInventoryLedgerReconciliationQuery } from './get-inventory-ledger-reconciliation.query';
import { GetInventoryValuationQuery } from '@modules/supply/inventory/application/queries/get-inventory-valuation/get-inventory-valuation.query';
import { GetTrialBalanceQuery } from '@modules/finance/accounting/posting/application/queries/get-trial-balance/get-trial-balance.query';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type {
  InventoryValuationCurrencyTotal,
  InventoryValuationLine,
} from '@modules/supply/inventory/domain/contracts';

/**
 * Mutabakat iki **ayrı kaynağı** karşılaştırır: envanter değeri (partiler) ve
 * 150 bakiyesi (fişler). Fark kendiliğinden hata değil; rapor farkı ve bilinen
 * sebeplerini gösterir, düzeltme yapmaz.
 */
describe('GetInventoryLedgerReconciliationHandler', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

  const ctx: IGetContext = {
    actor: { userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h' } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = (options: {
    lines?: InventoryValuationLine[];
    totals?: InventoryValuationCurrencyTotal[];
    functionalTotal?: string;
    hasForeignCurrencyStock?: boolean;
    stockAccount?: { debitBalance: string; creditBalance: string } | null;
  }) => {
    const execute = jest.fn((query: unknown) => {
      if (query instanceof GetInventoryValuationQuery) {
        return Promise.resolve({
          data: {
            clinicId: CLINIC_ID,
            asOf: new Date(),
            lines: options.lines ?? [],
            totals: options.totals ?? [],
            functionalTotal: options.functionalTotal ?? '0.00',
            hasForeignCurrencyStock: options.hasForeignCurrencyStock ?? false,
          },
        });
      }

      if (query instanceof GetTrialBalanceQuery) {
        return Promise.resolve({
          data: {
            clinicId: CLINIC_ID,
            dateFrom: null,
            dateTo: null,
            lines: options.stockAccount
              ? [
                  {
                    accountId: 'acc-150',
                    code: '150',
                    name: 'İlk Madde ve Malzeme',
                    totalDebit: options.stockAccount.debitBalance,
                    totalCredit: options.stockAccount.creditBalance,
                    debitBalance: options.stockAccount.debitBalance,
                    creditBalance: options.stockAccount.creditBalance,
                  },
                ]
              : [],
            totals: {
              totalDebit: '0',
              totalCredit: '0',
              debitBalance: '0',
              creditBalance: '0',
            },
            isBalanced: true,
          },
        });
      }

      throw new Error('beklenmeyen sorgu');
    });

    return {
      execute,
      run: () =>
        new GetInventoryLedgerReconciliationHandler({
          execute,
        } as never).execute(
          new GetInventoryLedgerReconciliationQuery(CLINIC_ID, ctx)
        ),
    };
  };

  const line = (
    overrides: Partial<InventoryValuationLine> = {}
  ): InventoryValuationLine => ({
    productId: 'p1',
    productName: 'Eldiven',
    stockCode: 'ELD-1',
    currency: 'TRY',
    quantity: '10',
    value: '1000.00',
    isProductDeleted: false,
    ...overrides,
  });

  it('envanter değeri 150 bakiyesine eşitse mutabık', async () => {
    const { run } = build({
      functionalTotal: '1000.00',
      lines: [line()],
      stockAccount: { debitBalance: '1000.00', creditBalance: '0' },
    });

    const result = await run();

    expect(result.data.inventoryValue).toBe('1000.00');
    expect(result.data.ledgerStockBalance).toBe('1000.00');
    expect(result.data.difference).toBe('0.00');
    expect(result.data.isReconciled).toBe(true);
  });

  it('fark raporlanır (stok defterden fazla → pozitif)', async () => {
    const { run } = build({
      functionalTotal: '1000.00',
      lines: [line()],
      stockAccount: { debitBalance: '600.00', creditBalance: '0' },
    });

    const result = await run();

    expect(result.data.difference).toBe('400.00');
    expect(result.data.isReconciled).toBe(false);
  });

  it('150 hiç hareket görmemişse bakiye sıfır kabul edilir ama fark görünür', async () => {
    const { run } = build({
      functionalTotal: '250.00',
      lines: [line({ value: '250.00' })],
      stockAccount: null,
    });

    const result = await run();

    expect(result.data.ledgerStockBalance).toBe('0.00');
    expect(result.data.difference).toBe('250.00');
  });

  it('yabancı para stoğu varsa "mutabık" denmez (karşılaştırma kısmi)', async () => {
    const { run } = build({
      functionalTotal: '1000.00',
      hasForeignCurrencyStock: true,
      totals: [
        { currency: 'TRY', value: '1000.00' },
        { currency: 'USD', value: '300.00' },
      ],
      lines: [line(), line({ currency: 'USD', value: '300.00' })],
      stockAccount: { debitBalance: '1000.00', creditBalance: '0' },
    });

    const result = await run();

    expect(result.data.difference).toBe('0.00');
    expect(result.data.isReconciled).toBe(false);
    expect(result.data.foreignCurrencyTotals).toEqual([
      { currency: 'USD', value: '300.00' },
    ]);
  });

  it('silinmiş ürün üzerindeki stok değeri ayrı gösterilir (farkın en olası sebebi)', async () => {
    const { run } = build({
      functionalTotal: '1500.00',
      lines: [line(), line({ value: '500.00', isProductDeleted: true })],
      stockAccount: { debitBalance: '1000.00', creditBalance: '0' },
    });

    const result = await run();

    expect(result.data.difference).toBe('500.00');
    expect(result.data.deletedProductValue).toBe('500.00');
  });

  it('150 alacak bakiyeliyse (negatif stok) bakiye eksi okunur', async () => {
    const { run } = build({
      functionalTotal: '0.00',
      stockAccount: { debitBalance: '0', creditBalance: '120.00' },
    });

    const result = await run();

    expect(result.data.ledgerStockBalance).toBe('-120.00');
    expect(result.data.difference).toBe('120.00');
  });
});
