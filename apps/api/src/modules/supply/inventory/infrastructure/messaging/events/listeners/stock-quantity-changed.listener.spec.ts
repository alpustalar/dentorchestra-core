import { randomUUID } from 'crypto';
import { StockQuantityChangedListener } from './stock-quantity-changed.listener';
import { StockQuantityChangedEvent } from '@modules/supply/inventory/domain/events';
import { StockMovement } from '@modules/supply/inventory/domain/entities/stock-movement.entity';
import { Decimal } from 'decimal.js';
import { Money } from '@src/domain/value-objects/money.vo';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';

describe('StockQuantityChangedListener', () => {
  const movementId = randomUUID();
  const productId = randomUUID();
  const clinicId = randomUUID();
  const batchId = randomUUID();
  /** Personel kimliği Firebase UID'dir (`User.id = firebaseUid`) — UUID DEĞİL. */
  const performedById = 'nQ7wE1rT5yU8iO2pL4kJ6hA3xY9z';

  const event = (
    overrides: Partial<{
      type: 'ADJUSTMENT' | 'USAGE' | 'PURCHASE' | 'WASTE';
      direction: 'IN' | 'OUT';
      unitPrice: string | null;
    }> = {}
  ): StockQuantityChangedEvent =>
    new StockQuantityChangedEvent({
      movementId,
      productId,
      clinicId,
      batchId,
      type: overrides.type ?? 'ADJUSTMENT',
      direction: overrides.direction ?? 'OUT',
      quantity: '3.5',
      unitPrice:
        overrides.unitPrice === undefined ? '12.50' : overrides.unitPrice,
      currency: 'TRY',
      performedById,
      notes: 'Batch üzerinden stok düşümü yapıldı.',
    });

  function build(
    options: {
      existing?: boolean;
      failsOnCreate?: boolean;
      existingMovement?: StockMovement;
    } = {}
  ) {
    const findById = jest
      .fn()
      .mockResolvedValue(
        options.existingMovement ??
          (options.existing ? ({} as StockMovement) : null)
      );

    const create = jest.fn((movement: StockMovement) =>
      options.failsOnCreate
        ? Promise.reject(new Error('db down'))
        : Promise.resolve(movement)
    );

    const repo = { findById, create, update: jest.fn() } as never;
    const execute = jest
      .fn<Promise<string>, [RecordFinancialEventCommand]>()
      .mockResolvedValue('financial-event-id');

    return {
      listener: new StockQuantityChangedListener(repo, {
        execute,
      } as never),
      findById,
      create,
      execute,
    };
  }

  it('olayı stok hareketine çevirip yazar', async () => {
    const { listener, create } = build();

    await listener.handle(event());

    expect(create).toHaveBeenCalledTimes(1);

    const written = create.mock.calls[0][0];
    expect(written.id.value).toBe(movementId);
    expect(written.productId.value).toBe(productId);
    expect(written.batchId?.value).toBe(batchId);
    expect(written.direction).toBe('OUT');
    expect(written.type).toBe('ADJUSTMENT');
    expect(written.quantity.value.toNumber()).toBe(3.5);
    expect(written.performedById).toBe(performedById);
    // Çıkış hareketi maliyetiyle yazılır: 3.5 × 12.50 = 43.75 (KDV yok).
    expect(written.unitPrice?.value.toFixed(2)).toBe('12.50');
    expect(written.totalAmount?.value.toFixed(2)).toBe('43.75');
  });

  it('aynı olay tekrar teslim edilirse hareket iki kez yazılmaz', async () => {
    const { listener, create } = build({ existing: true });

    await listener.handle(event());

    expect(create).not.toHaveBeenCalled();
  });

  it('yazma hatası yutulmaz — outbox kaydı yeniden denensin diye yukarı fırlatılır', async () => {
    const { listener } = build({ failsOnCreate: true });

    await expect(listener.handle(event())).rejects.toThrow('db down');
  });

  describe('deftere köprüleme', () => {
    it('tüketim hareketi STOCK_OUT ekonomik olayı yazar (maliyetiyle)', async () => {
      const { listener, execute } = build();

      await listener.handle(event({ type: 'USAGE' }));

      expect(execute).toHaveBeenCalledTimes(1);
      const { data } = execute.mock.calls[0][0];
      const command = { data } as {
        data: {
          type: string;
          clinicId: string;
          dedupeKey: string;
          sourceModule: string;
          payload: { amount: string; unitCost: string; movementType: string };
        };
      };

      expect(command.data.type).toBe('STOCK_OUT');
      expect(command.data.clinicId).toBe(clinicId);
      // 3.5 × 12.50 = 43.75
      expect(command.data.payload.amount).toBe('43.75');
      expect(command.data.payload.unitCost).toBe('12.50');
      expect(command.data.payload.movementType).toBe('USAGE');
      expect(command.data.sourceModule).toBe('inventory');
      // İdempotentlik anahtarı hareket kimliğinden türer: aynı olay tekrar
      // teslim edilirse olay defterine ikinci kayıt düşmez.
      expect(command.data.dedupeKey).toBe(`stock-movement:${movementId}`);
    });

    it('sayım fazlası (IN) STOCK_IN yazar', async () => {
      const { listener, execute } = build();

      await listener.handle(event({ type: 'ADJUSTMENT', direction: 'IN' }));

      expect(execute.mock.calls[0][0].data.type).toBe('STOCK_IN');
    });

    it('satın alma girişi köprülenmez — borç kaydı alış faturasından gelir', async () => {
      const { listener, execute } = build();

      await listener.handle(event({ type: 'PURCHASE', direction: 'IN' }));

      expect(execute).not.toHaveBeenCalled();
    });

    it('maliyet temeli yoksa köprülenmez (sıfır tutarlı fiş satırı geçersiz)', async () => {
      const { listener, execute } = build();

      await listener.handle(event({ type: 'USAGE', unitPrice: null }));

      expect(execute).not.toHaveBeenCalled();
    });

    it('hareket zaten yazılmışsa köprü yine denenir', async () => {
      // Tekrar teslimin sebebi tam olarak köprünün ilk denemede patlaması
      // olabilir: erken dönülürse hareket kalır, defter kaydı sonsuza dek
      // eksik kalırdı.
      const movement = StockMovement.create({
        id: movementId,
        productId,
        clinicId,
        batchId,
        type: 'USAGE',
        direction: 'OUT',
        quantity: new Decimal('3.5'),
        unitPrice: Money.create('12.50', 'TRY').orThrow(),
        performedById,
        notes: null,
      });

      const { listener, create, execute } = build({
        existingMovement: movement,
      });

      await listener.handle(event({ type: 'USAGE' }));

      expect(create).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
