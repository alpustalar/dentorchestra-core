import { StockOutRule } from './stock-out.rule';
import { StockInRule } from './stock-in.rule';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventTypeSchema } from '@shared';
import { UnmappedStockMovementTypeException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Stok hareketinin fişi: 150 bir bacak, karşı bacak hareketin **tipine** göre
 * belirlenir. Eşleme tek sabitte (`stock-movement-ledger.constant`) duruyor;
 * üretici de oradan besleniyor.
 */
describe('Stok hareketi posting kuralları', () => {
  const makeEvent = (
    type: 'STOCK_OUT' | 'STOCK_IN',
    payload: Record<string, unknown>
  ) =>
    new FinancialEvent({
      id: 'evt-1',
      organizationId: 'org-1',
      clinicId: 'clinic-1',
      type: FinancialEventTypeSchema.enum[type],
      occurredAt: new Date('2026-10-12'),
      payload: payload as never,
      sourceModule: 'inventory',
      sourceRefId: 'mov-1',
      dedupeKey: 'stock-movement:mov-1',
      performedById: null,
      createdAt: new Date('2026-10-12'),
    }).toPersistence();

  const basePayload = {
    movementId: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    quantity: '2.000',
    unitCost: '125.00',
    amount: '250.00',
  };

  describe('StockOutRule', () => {
    const rule = new StockOutRule();

    it('tüketim: B 740.01 / A 150 (dengeli)', () => {
      const draft = rule.build(
        makeEvent('STOCK_OUT', { ...basePayload, movementType: 'USAGE' })
      );

      expect(draft.lines).toEqual([
        {
          accountCode: '740.01',
          debit: '250.00',
          desc: 'Stok maliyeti',
        },
        {
          accountCode: '150',
          credit: '250.00',
          desc: 'Stok çıkışı',
        },
      ]);
      expect(draft.description).toBe('Sarf malzeme tüketimi');
    });

    it('zayi: B 689 / A 150', () => {
      const draft = rule.build(
        makeEvent('STOCK_OUT', { ...basePayload, movementType: 'WASTE' })
      );

      expect(draft.lines[0].accountCode).toBe('689');
      expect(draft.lines[1].accountCode).toBe('150');
    });

    it('sayım açığı (ADJUSTMENT/OUT): B 689 / A 150', () => {
      const draft = rule.build(
        makeEvent('STOCK_OUT', { ...basePayload, movementType: 'ADJUSTMENT' })
      );

      expect(draft.lines[0].accountCode).toBe('689');
    });

    it('eşlemesi olmayan tip sessizce bir hesaba yazılmaz', () => {
      // Satın alma girişinin borç kaydı faturadan gelir; bu olay hiç
      // üretilmemeli. Üretilirse fiş kendi içinde dengeli olacağı için yanlış
      // hesap hiçbir kontrolde görünmezdi.
      expect(() =>
        rule.build(
          makeEvent('STOCK_OUT', { ...basePayload, movementType: 'PURCHASE' })
        )
      ).toThrow(UnmappedStockMovementTypeException);
    });
  });

  describe('StockInRule', () => {
    const rule = new StockInRule();

    it('sayım fazlası: B 150 / A 679', () => {
      const draft = rule.build(
        makeEvent('STOCK_IN', { ...basePayload, movementType: 'ADJUSTMENT' })
      );

      expect(draft.lines).toEqual([
        { accountCode: '150', debit: '250.00', desc: 'Stok girişi' },
        { accountCode: '679', credit: '250.00', desc: 'Sayım fazlası' },
      ]);
    });

    it('satın alma girişi bu kuraldan geçmez (mükerrer 150 borcu olurdu)', () => {
      expect(() =>
        rule.build(
          makeEvent('STOCK_IN', { ...basePayload, movementType: 'PURCHASE' })
        )
      ).toThrow(UnmappedStockMovementTypeException);
    });

    it('tüketim tipi girişte eşlenmez', () => {
      expect(() =>
        rule.build(
          makeEvent('STOCK_IN', { ...basePayload, movementType: 'USAGE' })
        )
      ).toThrow(UnmappedStockMovementTypeException);
    });
  });
});
