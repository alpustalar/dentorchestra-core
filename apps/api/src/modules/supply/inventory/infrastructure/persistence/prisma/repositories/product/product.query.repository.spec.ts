import { Decimal } from 'decimal.js';
import { ProductQueryRepository } from './product.query.repository';

/**
 * Stok seviyesi listesi **ürünlerden** kurulur, partilerden değil: parti bazlı
 * gruplama `quantity > 0` süzdüğü için stoğu tükenen ürün listeden tamamen
 * düşüyordu — kritik stok uyarısı en kritik durumu (tükenmiş ürün) hiç
 * göstermiyordu.
 */
describe('ProductQueryRepository.getStockLevels', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

  const build = (
    rows: {
      id: string;
      name: string;
      stockCode: string;
      criticalStockQty: Decimal;
    }[],
    batchSums: { productId: string; quantity: number }[]
  ) => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue(rows) },
      productBatch: {
        groupBy: jest.fn().mockResolvedValue(
          batchSums.map((b) => ({
            productId: b.productId,
            _sum: { quantity: new Decimal(b.quantity) },
          }))
        ),
      },
    };

    return {
      prisma,
      repo: new ProductQueryRepository(prisma as never),
    };
  };

  const products: {
    id: string;
    name: string;
    stockCode: string;
    criticalStockQty: Decimal;
  }[] = [
    {
      id: 'p1',
      name: 'Eldiven',
      stockCode: 'ELD-1',
      criticalStockQty: new Decimal(5),
    },
    {
      id: 'p2',
      name: 'Maske',
      stockCode: 'MSK-1',
      criticalStockQty: new Decimal(10),
    },
  ];

  it('stoğu hiç olmayan ürün 0 olarak listelenir ve kritik sayılır', async () => {
    const { repo } = build(products, [{ productId: 'p1', quantity: 20 }]);

    const levels = await repo.getStockLevels(CLINIC_ID);

    expect(levels).toHaveLength(2);

    const maske = levels.find((l) => l.productId === 'p2')!;
    expect(maske.totalQuantity).toBe('0');
    expect(maske.isBelowCritical).toBe(true);
  });

  it('kritik stok uyarısı tükenen ürünü de içerir', async () => {
    const { repo } = build(products, [{ productId: 'p1', quantity: 20 }]);

    const alerts = await repo.getLowStockAlerts(CLINIC_ID);

    expect(alerts.map((a) => a.productId)).toEqual(['p2']);
  });

  it('kliniğin hiç ürünü yoksa boş döner (parti sorgusu bile yapılmaz)', async () => {
    const { repo, prisma } = build([], []);

    await expect(repo.getStockLevels(CLINIC_ID)).resolves.toEqual([]);
    expect(prisma.productBatch.groupBy).not.toHaveBeenCalled();
  });

  it('ürünler ve partiler kliniğe göre süzülür', async () => {
    const { repo, prisma } = build(products, []);

    await repo.getStockLevels(CLINIC_ID);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinicId: CLINIC_ID, deletedAt: null, isActive: true },
      })
    );
    expect(prisma.productBatch.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinicId: CLINIC_ID, productId: { in: ['p1', 'p2'] } },
      })
    );
  });
});
