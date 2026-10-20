import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { Product } from './product.entity';
import { ProductBatch } from './product-batch.entity';
import { StockQuantityChangedEvent } from '@modules/supply/inventory/domain/events';
import { Product as IProduct, ProductBatch as IProductBatch } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  NoLotToDeductException,
  ProductNotUsableInClinicException,
  StockIncreaseRequiresReceiptException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';

describe('Product.handleStockChange', () => {
  const clinicId = randomUUID();
  const performedById = randomUUID();

  const product = (): Product => {
    const now = DateTimeManager.create();
    return new Product({
      id: randomUUID(),
      clinicId,
      organizationId: randomUUID(),
      categoryId: null,
      supplierId: null,
      name: 'Anestezik solüsyon',
      stockCode: 'ANS-001',
      barcode: null,
      brand: null,
      description: null,
      imageUrl: null,
      unit: 'PIECE',
      condition: null,
      vatRate: new Decimal(20),
      criticalStockQty: new Decimal(5),
      reorderQty: new Decimal(10),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as IProduct);
  };

  const batchOf = (productId: string, quantity: number): ProductBatch => {
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

  const changedEvents = (
    aggregate: Product | ProductBatch
  ): StockQuantityChangedEvent[] =>
    aggregate
      .getDomainEvents()
      .filter(
        (e): e is StockQuantityChangedEvent =>
          e instanceof StockQuantityChangedEvent
      );

  it('artışta partiyi döner; olayı parti taşır, ürün taşımaz', () => {
    const item = product();
    const batch = batchOf(item.id.value, 10);

    const updated = item.handleStockChange({
      quantityDelta: 4,
      clinicId,
      availableBatches: [batch],
      performedById,
    });

    expect(updated).toBe(batch);
    expect(batch.quantity.value.toNumber()).toBe(14);
    expect(changedEvents(batch)[0].direction).toBe('IN');
    expect(changedEvents(item)).toHaveLength(0);
  });

  it('düşümde partiden düşer ve OUT olayını parti taşır', () => {
    const item = product();
    const batch = batchOf(item.id.value, 10);

    const updated = item.handleStockChange({
      quantityDelta: -4,
      clinicId,
      availableBatches: [batch],
      performedById,
    });

    expect(updated).toBe(batch);
    expect(batch.quantity.value.toNumber()).toBe(6);
    expect(changedEvents(batch)[0].direction).toBe('OUT');
  });

  it('açık batchId verilirse o parti hedeflenir', () => {
    const item = product();
    const first = batchOf(item.id.value, 10);
    const second = batchOf(item.id.value, 10);

    const updated = item.handleStockChange({
      quantityDelta: -2,
      clinicId,
      availableBatches: [first, second],
      explicitBatchId: second.id.value,
      performedById,
    });

    expect(updated).toBe(second);
    expect(second.quantity.value.toNumber()).toBe(8);
    expect(first.quantity.value.toNumber()).toBe(10);
  });

  it('parti yokken artış reddedilir — mal kabule yönlendirir, olay üretilmez', () => {
    // Regresyon: eskiden `null` dönüp yalnız hareket kaydı yazılıyordu. Stok
    // seviyesi `Σ product_batches.quantity` olduğu için **miktar hiç
    // artmıyordu**: kullanıcı "düzeltme yapıldı" cevabı alıyor, stok olduğu
    // yerde kalıyordu (girişin maliyeti de yoktu).
    const item = product();

    expect(() =>
      item.handleStockChange({
        quantityDelta: 7,
        clinicId,
        availableBatches: [],
        performedById,
      })
    ).toThrow(StockIncreaseRequiresReceiptException);

    expect(changedEvents(item)).toHaveLength(0);
  });

  it('parti yokken düşüm reddedilir — olay üretilmez', () => {
    const item = product();

    expect(() =>
      item.handleStockChange({
        quantityDelta: -3,
        clinicId,
        availableBatches: [],
        performedById,
      })
    ).toThrow(NoLotToDeductException);

    expect(changedEvents(item)).toHaveLength(0);
  });

  it('başka kliniğin ürününde işlem reddedilir (domain hatası, 500 değil)', () => {
    const item = product();

    expect(() =>
      item.handleStockChange({
        quantityDelta: 1,
        clinicId: randomUUID(),
        availableBatches: [],
        performedById,
      })
    ).toThrow(ProductNotUsableInClinicException);
  });

  it('düşüm olayı partinin maliyetini taşır (çıkan malın değeri)', () => {
    // Hareket kaydının `unitPrice`/`totalAmount` kolonları bu alandan dolar;
    // taşınmadığı sürece bütün çıkışlar değersiz kaydediliyordu.
    const item = product();
    const batch = batchOf(item.id.value, 10);

    item.handleStockChange({
      quantityDelta: -4,
      clinicId,
      availableBatches: [batch],
      performedById,
    });

    const event = changedEvents(batch)[0];
    expect(event.unitPrice).toBe('100.00');
    expect(event.currency).toBe('TRY');
  });
});

/**
 * Ürün kartının KDV oranı kapısı. `0` **yasal kümenin üyesidir**
 * (`STATUTORY_VAT_RATES = [0, 1, 10, 20]`) ve istisna/muafiyet kapsamındaki
 * malın oranı gerçekten sıfırdır. Entity `hasTax.orThrow()` ile hem oluşturmada
 * hem güncellemede sıfırı reddediyordu; DTO ise 0'ı kabul ediyordu → kapı
 * kullanım yerinden **geniş**ti (CLAUDE.md finans kuralı 12) ve istek
 * sebebinden kopuk bir "KDV oranı sıfır olamaz" hatasıyla duruyordu.
 */
describe('Product — KDV oranı kapısı', () => {
  const createProps = (vatRate: number) => ({
    clinicId: randomUUID(),
    organizationId: randomUUID(),
    name: 'İstisna kapsamı tıbbi cihaz',
    stockCode: 'IST-001',
    unit: 'PIECE' as const,
    vatRate,
    criticalStockQty: 0,
    reorderQty: 0,
  });

  it('%0 ile ürün OLUŞTURULABİLİR (istisna/muafiyet)', () => {
    const created = Product.create(createProps(0));

    expect(created.vatRate.value.toNumber()).toBe(0);
  });

  it('%0 ile oran GÜNCELLENEBİLİR — sıfır KDV’li ürünün kartı kilitli kalmaz', () => {
    const created = Product.create(createProps(20));

    created.update({ vatRate: 0 });

    expect(created.vatRate.value.toNumber()).toBe(0);
  });

  it('yasal olmayan oran (%8) hem oluşturmada hem güncellemede reddedilir', () => {
    expect(() => Product.create(createProps(8))).toThrow();

    const created = Product.create(createProps(20));
    expect(() => created.update({ vatRate: 8 })).toThrow();
  });
});
