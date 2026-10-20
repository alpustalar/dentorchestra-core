import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { ProductBatch } from './product-batch.entity';
import { StockQuantityChangedEvent } from '@modules/supply/inventory/domain/events';
import { ProductBatch as IProductBatch } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

describe('ProductBatch — miktar değişimi olayı', () => {
  const productId = randomUUID();
  const clinicId = randomUUID();
  const performedById = randomUUID();

  const batchWith = (quantity: number): ProductBatch => {
    const now = DateTimeManager.create();
    return new ProductBatch({
      id: randomUUID(),
      productId,
      clinicId,
      supplierId: null,
      lotNumber: 'LOT-1',
      expiresAt: null,
      quantity: new Decimal(quantity),
      purchasePrice: new Decimal(100),
      currency: 'TRY',
      receivedAt: now,
      notes: null,
      createdAt: now,
      updatedAt: now,
    } as IProductBatch);
  };

  const changedEvents = (batch: ProductBatch): StockQuantityChangedEvent[] =>
    batch
      .getDomainEvents()
      .filter(
        (e): e is StockQuantityChangedEvent =>
          e instanceof StockQuantityChangedEvent
      );

  it('deductQuantity → miktarı düşer, hiçbir şey döndürmez, OUT olayı fırlatır', () => {
    const batch = batchWith(10);

    const result = batch.deductQuantity({
      qty: new Decimal(3),
      performedById,
    });

    expect(result).toBeUndefined();
    expect(batch.quantity.value.toNumber()).toBe(7);

    const events = changedEvents(batch);
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('OUT');
    expect(events[0].type).toBe('ADJUSTMENT');
    expect(events[0].quantity).toBe('3');
    expect(events[0].batchId).toBe(batch.id.value);
    expect(events[0].productId).toBe(productId);
    expect(events[0].performedById).toBe(performedById);
  });

  it('addQuantity → miktarı artırır, hiçbir şey döndürmez, IN olayı fırlatır', () => {
    const batch = batchWith(10);

    const result = batch.addQuantity({
      qty: new Decimal(5),
      performedById,
      notes: 'sayım farkı',
    });

    expect(result).toBeUndefined();
    expect(batch.quantity.value.toNumber()).toBe(15);

    const events = changedEvents(batch);
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('IN');
    expect(events[0].quantity).toBe('5');
    expect(events[0].notes).toBe('sayım farkı');
  });

  it("hareket id'si olayla taşınır — verilirse korunur (outbox tekrarında idempotenslik)", () => {
    const movementId = randomUUID();
    const batch = batchWith(10);

    batch.deductQuantity({ qty: new Decimal(1), performedById, movementId });

    expect(changedEvents(batch)[0].movementId).toBe(movementId);
  });

  it("verilmeyen hareket id'si üretilir ve her değişim için ayrıdır", () => {
    const batch = batchWith(10);

    batch.deductQuantity({ qty: new Decimal(1), performedById });
    batch.addQuantity({ qty: new Decimal(2), performedById });

    const events = changedEvents(batch);
    expect(events).toHaveLength(2);
    expect(events[0].movementId).toBeDefined();
    expect(events[0].movementId).not.toBe(events[1].movementId);
  });

  it('sıfır/negatif miktar reddedilir — bakiye ve olay üretilmez', () => {
    const batch = batchWith(10);

    expect(() =>
      batch.deductQuantity({ qty: new Decimal(0), performedById })
    ).toThrow();

    expect(batch.quantity.value.toNumber()).toBe(10);
    expect(changedEvents(batch)).toHaveLength(0);
  });
});
