import { Decimal } from 'decimal.js';
import { StockMovementQueryRepository } from './stock-movement.query.repository';

/**
 * Sapma sorgusunun **mapping'ini** kilitler: Prisma `Decimal` → string
 * dönüşümü burada yapılıyor ve miktar ile tutar farklı ölçeklerde
 * (`quantity` 3 hane, `valueDrift` kuruş). Yanlış ölçek rapora sessizce
 * yuvarlanmış bir sapma yazardı.
 */
describe('StockMovementQueryRepository.getBatchQuantityDrift', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

  const build = (rows: Record<string, unknown>[]) => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) };
    return {
      prisma,
      repo: new StockMovementQueryRepository(prisma as never),
    };
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    batch_id: 'b1',
    product_id: 'p1',
    product_name: 'Eldiven',
    stock_code: 'ELD-1',
    lot_number: 'LOT-1',
    currency: 'TRY',
    batch_quantity: new Decimal('10.500'),
    movement_quantity: new Decimal('8.000'),
    value_drift: new Decimal('250.00'),
    batch_updated_at: new Date('2026-10-12T10:00:00.000Z'),
    ...overrides,
  });

  it('miktar ve tutarı doğru ölçekte string olarak döner', async () => {
    const { repo } = build([row()]);

    const [line] = await repo.getBatchQuantityDrift(CLINIC_ID);

    expect(line.batchQuantity).toBe('10.5');
    expect(line.movementQuantity).toBe('8');
    // Sapma miktar ölçeğinde (yuvarlanmaz), değer kuruş ölçeğinde.
    expect(line.quantityDrift).toBe('2.5');
    expect(line.valueDrift).toBe('250.00');
  });

  it('hiç hareketi olmayan parti: hareket toplamı 0 kabul edilir', async () => {
    const { repo } = build([
      row({
        movement_quantity: new Decimal('0'),
        value_drift: new Decimal('1050.00'),
      }),
    ]);

    const [line] = await repo.getBatchQuantityDrift(CLINIC_ID);

    expect(line.movementQuantity).toBe('0');
    expect(line.quantityDrift).toBe('10.5');
  });

  it('negatif sapma (hareket fazla) işaretiyle taşınır', async () => {
    const { repo } = build([
      row({
        batch_quantity: new Decimal('5.000'),
        movement_quantity: new Decimal('7.000'),
        value_drift: new Decimal('-200.00'),
      }),
    ]);

    const [line] = await repo.getBatchQuantityDrift(CLINIC_ID);

    expect(line.quantityDrift).toBe('-2');
    expect(line.valueDrift).toBe('-200.00');
  });

  it('parti kimliği, lot ve son güncelleme anı taşınır (outbox gecikmesi ayırt edilsin)', async () => {
    const { repo } = build([row()]);

    const [line] = await repo.getBatchQuantityDrift(CLINIC_ID);

    expect(line.batchId).toBe('b1');
    expect(line.lotNumber).toBe('LOT-1');
    expect(line.batchUpdatedAt).toEqual(new Date('2026-10-12T10:00:00.000Z'));
  });

  it('sorgu klinikle sınırlı çalışır', async () => {
    const { repo, prisma } = build([]);

    await repo.getBatchQuantityDrift(CLINIC_ID);

    const [sqlArg] = prisma.$queryRaw.mock.calls[0] as [{ values: unknown[] }];
    // Klinik kimliği bağlı parametre olarak geçer (iki kez: hareket CTE'si + parti).
    expect(sqlArg.values).toEqual([CLINIC_ID, CLINIC_ID]);
  });
});
