import {
  AdjustStockSchema,
  CreateProductSchema,
  ReceiveStockSchema,
} from '@shared/modules/inventory/schemas/commands';

/**
 * Yazma kapıları kullanım yerinden geniş olamaz (CLAUDE.md finans kuralı 12):
 * ondalık sınırları kolonlardan (`Decimal(10,2)` / `Decimal(10,3)`), KDV kümesi
 * `VatRate` VO'sundan gelir. Sayım düzeltmesi ayrıca gerekçe ister.
 */
describe('AdjustStockSchema', () => {
  const base = {
    productId: '11111111-1111-4111-8111-111111111111',
    notes: 'Sayım farkı',
  };

  it('gerekçe zorunludur — belgesiz stok değişiminin tek izi', () => {
    expect(
      AdjustStockSchema.safeParse({
        ...base,
        quantityDelta: -2,
        notes: undefined,
      }).success
    ).toBe(false);
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: -2, notes: 'kısa' })
        .success
    ).toBe(false);
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: -2 }).success
    ).toBe(true);
  });

  it('negatif ve pozitif 3 ondalıklı delta kabul edilir', () => {
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: -1.125 }).success
    ).toBe(true);
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: 1.125 }).success
    ).toBe(true);
  });

  it('4 ondalıklı delta reddedilir (kolon Decimal(10,3))', () => {
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: 1.1255 }).success
    ).toBe(false);
  });

  it('sıfır delta reddedilir', () => {
    expect(
      AdjustStockSchema.safeParse({ ...base, quantityDelta: 0 }).success
    ).toBe(false);
  });
});

describe('ReceiveStockSchema', () => {
  const base = {
    productId: '11111111-1111-4111-8111-111111111111',
    quantity: 10,
    purchasePrice: 25.5,
    currency: 'TRY',
  };

  it('kuruş ölçeğindeki alış fiyatını kabul eder', () => {
    expect(ReceiveStockSchema.safeParse(base).success).toBe(true);
  });

  it('kuruş altı alış fiyatını reddeder (parti maliyeti yuvarlanırdı)', () => {
    expect(
      ReceiveStockSchema.safeParse({ ...base, purchasePrice: 25.555 }).success
    ).toBe(false);
  });

  it('4 ondalıklı miktarı reddeder', () => {
    expect(
      ReceiveStockSchema.safeParse({ ...base, quantity: 1.0005 }).success
    ).toBe(false);
  });

  it('yasal olmayan KDV oranını reddeder', () => {
    // %8 ile mal kabul yazılabiliyor, hareket kaydı `VatRate` ile reddediyordu.
    expect(ReceiveStockSchema.safeParse({ ...base, vatRate: 8 }).success).toBe(
      false
    );
    expect(ReceiveStockSchema.safeParse({ ...base, vatRate: 10 }).success).toBe(
      true
    );
  });
});

describe('CreateProductSchema', () => {
  const base = {
    name: 'Eldiven',
    stockCode: 'ELD-001',
    unit: 'PIECE',
    clinicId: '11111111-1111-4111-8111-111111111111',
    vatRate: 20,
  };

  it('yasal KDV oranını kabul, diğerini reddeder', () => {
    expect(CreateProductSchema.safeParse(base).success).toBe(true);
    expect(CreateProductSchema.safeParse({ ...base, vatRate: 8 }).success).toBe(
      false
    );
  });

  it('KDV oranı ZORUNLU — sessiz sıfır varsayılanı yok', () => {
    // Alan opsiyoneldi ve handler `?? 0` ile dolduruyordu: oranı söylemeyen
    // istek sessizce "istisna kapsamında" sayılıyor, ürünün oranı alış
    // faturasının 191 indirilecek KDV'sini beslediği için indirim kimse
    // seçmemişken eksik kullanılıyordu.
    const withoutRate = Object.fromEntries(
      Object.entries(base).filter(([key]) => key !== 'vatRate')
    );

    expect(CreateProductSchema.safeParse(withoutRate).success).toBe(false);
  });

  it('%0 kabul edilir (istisna/muafiyet) — entity bunu REDDEDİYORDU', () => {
    // 0, `STATUTORY_VAT_RATES`'in üyesidir. Kapı 0'ı kabul ederken entity
    // `hasTax.orThrow()` ile reddediyordu: kapı kullanım yerinden genişti ve
    // istek sebebinden kopuk bir hatayla duruyordu (kural 12).
    expect(CreateProductSchema.safeParse({ ...base, vatRate: 0 }).success).toBe(
      true
    );
  });

  it('organizationId taşınmaz (kiracı kimliği clinicId den çözülür)', () => {
    const result = CreateProductSchema.safeParse({
      ...base,
      organizationId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('organizationId');
  });

  it('kritik stok miktarı 3 ondalıkla sınırlı', () => {
    expect(
      CreateProductSchema.safeParse({ ...base, criticalStockQty: 1.125 })
        .success
    ).toBe(true);
    expect(
      CreateProductSchema.safeParse({ ...base, criticalStockQty: 1.1255 })
        .success
    ).toBe(false);
  });
});
