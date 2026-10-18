import {
  CreatePurchaseOrderSchema,
  ReceivePurchaseOrderSchema,
} from '@shared/modules/purchasing/schemas/commands';

/**
 * Yazma kapısı, kullanım yerinden geniş olamaz (CLAUDE.md finans kuralı 12):
 *  - tutar/miktar ondalıkları DB kolonlarının ölçeğinde (12,2) / (12,3),
 *  - KDV oranı yasal kümede (`VatRate` VO aynı listeyi zorluyor).
 */
describe('CreatePurchaseOrderSchema', () => {
  const base = {
    clinicId: '11111111-1111-4111-8111-111111111111',
    supplierId: '33333333-3333-4333-8333-333333333333',
  };

  const withItem = (item: Record<string, unknown>) =>
    CreatePurchaseOrderSchema.safeParse({
      ...base,
      items: [{ description: 'Eldiven', quantity: 1, unitPrice: 10, ...item }],
    });

  it('kuruş ölçeğindeki fiyatı kabul eder', () => {
    expect(withItem({ unitPrice: 10.55 }).success).toBe(true);
  });

  it('kuruş altı fiyatı reddeder (kolon Decimal(12,2) — sessizce yuvarlanırdı)', () => {
    expect(withItem({ unitPrice: 10.555 }).success).toBe(false);
  });

  it('3 ondalıklı miktarı kabul, 4 ondalıklıyı reddeder', () => {
    expect(withItem({ quantity: 1.005 }).success).toBe(true);
    expect(withItem({ quantity: 1.0005 }).success).toBe(false);
  });

  it('yasal KDV oranını kabul eder', () => {
    for (const vatRate of [0, 1, 10, 20]) {
      expect(withItem({ vatRate }).success).toBe(true);
    }
  });

  it('yasal olmayan KDV oranını reddeder (o sipariş mal kabul edilemez olurdu)', () => {
    // %8'lik sipariş yazılabiliyordu; mal kabulde `StockMovement` içindeki
    // `VatRate` onu reddettiği için sipariş kalıcı olarak teslim alınamazdı.
    expect(withItem({ vatRate: 8 }).success).toBe(false);
  });

  it('organizationId göndermek şemayı bozmaz ama alan taşınmaz', () => {
    // Kiracı kimliği istemciden alınmaz; `clinicId`'den çözülür.
    const result = CreatePurchaseOrderSchema.safeParse({
      ...base,
      organizationId: '22222222-2222-4222-8222-222222222222',
      items: [{ description: 'Eldiven', quantity: 1, unitPrice: 10 }],
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('organizationId');
  });
});

describe('ReceivePurchaseOrderSchema', () => {
  const withQuantity = (quantity: number) =>
    ReceivePurchaseOrderSchema.safeParse({
      items: [{ itemId: '44444444-4444-4444-8444-444444444444', quantity }],
    });

  it('3 ondalıklı teslim miktarını kabul eder', () => {
    expect(withQuantity(2.5).success).toBe(true);
    expect(withQuantity(2.125).success).toBe(true);
  });

  it('4 ondalıklı miktarı reddeder (kümülatif sayaç DB de yuvarlanırdı)', () => {
    expect(withQuantity(2.1255).success).toBe(false);
  });

  it('sıfır veya negatif teslim kabul edilmez', () => {
    expect(withQuantity(0).success).toBe(false);
    expect(withQuantity(-1).success).toBe(false);
  });
});
