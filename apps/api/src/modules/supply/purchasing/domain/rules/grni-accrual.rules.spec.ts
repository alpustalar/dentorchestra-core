import {
  GrniAccrualOrderInput,
  buildGrniAccrualReport,
} from './grni-accrual.rules';

/**
 * Yıl sonu GRNI tahakkuku: "31 Aralık itibarıyla malı gelmiş, faturası gelmemiş" tutar.
 *
 * İlkeler: (1) KDV HARİÇ — KDV fatura kesilince doğar. (2) Teslim günlükten, anlık fiyatla.
 * (3) Yabancı para tahakkuk edilemez. (4) İki yön netleşmez: teslim > fatura → aday; fatura >
 * teslim → yalnız STOK faturasında bilgi uyarısı.
 */
describe('buildGrniAccrualReport', () => {
  const order = (
    overrides: Partial<GrniAccrualOrderInput> = {}
  ): GrniAccrualOrderInput => ({
    id: 'o1',
    supplierId: 's1',
    orderDate: new Date('2026-10-01'),
    currency: 'TRY',
    items: [{ id: 'i1', productId: 'p1' }],
    receipts: [
      {
        source: 'GOODS_RECEIPT',
        lines: [{ itemId: 'i1', quantity: '10', unitPrice: '100.00' }],
      },
    ],
    invoices: [],
    ...overrides,
  });

  const report = (orders: GrniAccrualOrderInput[]) =>
    buildGrniAccrualReport({ functionalCurrency: 'TRY', orders });

  it('faturasız teslim: tutar KDV HARİÇ teslim değeridir', () => {
    const { candidates } = report([order()]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      orderId: 'o1',
      receivedNet: '1000.00',
      invoicedNet: '0.00',
      accrualAmount: '1000.00',
      accruable: true,
      notAccruableReason: null,
    });
  });

  it('kısmen faturalı: tahakkuk teslim − fatura matrahı', () => {
    const { candidates } = report([
      order({ invoices: [{ netTotal: '600.00', lineAccountCode: '150' }] }),
    ]);

    expect(candidates[0].accrualAmount).toBe('400.00');
    expect(candidates[0].invoicedNet).toBe('600.00');
  });

  it('tam faturalı sipariş aday değildir', () => {
    const result = report([
      order({ invoices: [{ netTotal: '1000.00', lineAccountCode: '150' }] }),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.invoicedNotReceived).toEqual([]);
  });

  it('birden çok kabul ve kalem toplanır; her satır kendi başına kuruşa yuvarlanır', () => {
    const { candidates } = report([
      order({
        items: [
          { id: 'i1', productId: 'p1' },
          { id: 'i2', productId: 'p2' },
        ],
        receipts: [
          {
            source: 'GOODS_RECEIPT',
            // 0.333 × 10.00 = 3.33
            lines: [{ itemId: 'i1', quantity: '0.333', unitPrice: '10.00' }],
          },
          {
            source: 'GOODS_RECEIPT',
            // 2 × 1.005 → fiyat kuruşa sabitlenmiş (2 ondalık) gelir; 3 × 3.34 = 10.02
            lines: [{ itemId: 'i2', quantity: '3', unitPrice: '3.34' }],
          },
        ],
      }),
    ]);

    expect(candidates[0].receivedNet).toBe('13.35');
    expect(candidates[0].accrualAmount).toBe('13.35');
  });

  it('önerilen borç hesabı: tüm kalemler katalog ürünüyse 150, serbest kalem varsa belirsiz', () => {
    const catalog = report([order()]).candidates[0];
    expect(catalog.suggestedDebitAccountCode).toBe('150');

    const free = report([
      order({
        items: [
          { id: 'i1', productId: 'p1' },
          { id: 'i2', productId: null },
        ],
        receipts: [
          {
            source: 'GOODS_RECEIPT',
            lines: [
              { itemId: 'i1', quantity: '1', unitPrice: '10.00' },
              { itemId: 'i2', quantity: '1', unitPrice: '10.00' },
            ],
          },
        ],
      }),
    ]).candidates[0];
    // Hesabı makine tahmin etmez: gider mi hizmet mi muhasebecinin kararı.
    expect(free.suggestedDebitAccountCode).toBeNull();
  });

  it('yalnız TESLİM EDİLMİŞ kalemler önerilen hesabı belirler (serbest kalem teslim edilmediyse 150)', () => {
    const { candidates } = report([
      order({
        items: [
          { id: 'i1', productId: 'p1' },
          { id: 'i2', productId: null }, // hiç teslim edilmedi
        ],
      }),
    ]);

    expect(candidates[0].suggestedDebitAccountCode).toBe('150');
  });

  it('yabancı para birimli sipariş adaydır ama tahakkuk EDİLEMEZ', () => {
    const { candidates } = report([order({ currency: 'EUR' })]);

    expect(candidates[0]).toMatchObject({
      currency: 'EUR',
      accruable: false,
      notAccruableReason: 'FOREIGN_CURRENCY',
    });
  });

  it('günlük öncesi kabullerden türetilmiş teslim işaretlenir', () => {
    const legacy = report([
      order({
        receipts: [
          {
            source: 'LEGACY_BACKFILL',
            lines: [{ itemId: 'i1', quantity: '10', unitPrice: '100.00' }],
          },
        ],
      }),
    ]).candidates[0];
    const live = report([order()]).candidates[0];

    expect(legacy.includesLegacyReceipts).toBe(true);
    expect(live.includesLegacyReceipts).toBe(false);
  });

  describe('fatura > teslim (K4)', () => {
    it('STOK faturası teslimden fazlaysa bilgi uyarısı üretir, aday üretmez', () => {
      const result = report([
        order({
          receipts: [
            {
              source: 'GOODS_RECEIPT',
              lines: [{ itemId: 'i1', quantity: '2', unitPrice: '100.00' }],
            },
          ],
          invoices: [{ netTotal: '500.00', lineAccountCode: '150' }],
        }),
      ]);

      expect(result.candidates).toEqual([]);
      expect(result.invoicedNotReceived).toEqual([
        {
          orderId: 'o1',
          supplierId: 's1',
          currency: 'TRY',
          invoicedNet: '500.00',
          receivedNet: '200.00',
          difference: '300.00',
        },
      ]);
    });

    it('GİDER faturasında kabul kavramı yoktur: uyarı üretilmez', () => {
      const result = report([
        order({
          receipts: [],
          invoices: [{ netTotal: '500.00', lineAccountCode: '770' }],
        }),
      ]);

      expect(result.invoicedNotReceived).toEqual([]);
      expect(result.candidates).toEqual([]);
    });

    it('hiç kabulü olmayan ama stok faturası olan sipariş de uyarılır', () => {
      const result = report([
        order({
          receipts: [],
          invoices: [{ netTotal: '120.00', lineAccountCode: '153' }],
        }),
      ]);

      expect(result.invoicedNotReceived[0]).toMatchObject({
        orderId: 'o1',
        difference: '120.00',
        receivedNet: '0.00',
      });
    });
  });

  it('adaylar en büyük tutar önce sıralanır', () => {
    const { candidates } = report([
      order({
        id: 'small',
        receipts: [
          {
            source: 'GOODS_RECEIPT',
            lines: [{ itemId: 'i1', quantity: '1', unitPrice: '10.00' }],
          },
        ],
      }),
      order({ id: 'big' }),
    ]);

    expect(candidates.map((c) => c.orderId)).toEqual(['big', 'small']);
  });
});
