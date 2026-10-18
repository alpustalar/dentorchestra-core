import {
  buildGoodsReceiptVarianceReport,
  GoodsReceiptVarianceOrderInput,
} from './purchase-order-billing.rules';

/**
 * Mal kabul ↔ fatura mutabakatı (GRNI).
 *
 * Raporun asıl işi, iki **ayrı** muhasebe kalemini ayrı tutmaktır: faturası
 * gelmemiş mal bir **borç tahakkuku** adayı (mal elimizde), malı gelmemiş fatura
 * ise bir **avans/varlık** kalemidir. Netleştirilseydi toplam sıfıra yakın
 * çıkar, ikisi de görünmez olurdu.
 */
describe('buildGoodsReceiptVarianceReport', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ASOF = new Date('2026-10-31T00:00:00.000Z');

  const order = (
    overrides: Partial<GoodsReceiptVarianceOrderInput> = {}
  ): GoodsReceiptVarianceOrderInput => ({
    id: 'order-1',
    supplierId: 'supplier-1',
    orderDate: new Date('2026-10-01'),
    currency: 'TRY',
    status: 'PARTIALLY_RECEIVED',
    billingStatus: 'NOT_BILLED',
    grandTotal: '1200.00',
    invoicedTotal: '0.00',
    // 10 × 100 + %20 KDV = 1200 sipariş; 10 teslim alındı.
    lines: [{ quantityReceived: '10', unitPrice: '100', vatRate: 20 }],
    ...overrides,
  });

  const run = (orders: GoodsReceiptVarianceOrderInput[]) =>
    buildGoodsReceiptVarianceReport({
      clinicId: CLINIC_ID,
      asOf: ASOF,
      orders,
    });

  it('mal geldi faturası gelmedi: pozitif sapma tahakkuk adayı olarak toplanır', () => {
    const report = run([order()]);

    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].receivedValue).toBe('1200.00');
    expect(report.lines[0].invoicedTotal).toBe('0.00');
    expect(report.lines[0].receiptVariance).toBe('1200.00');
    expect(report.totals).toEqual([
      {
        currency: 'TRY',
        notInvoicedTotal: '1200.00',
        notReceivedTotal: '0.00',
        orderCount: 1,
      },
    ]);
  });

  it('fatura geldi mal gelmedi: negatif sapma AVANS tarafında toplanır', () => {
    const report = run([
      order({
        lines: [{ quantityReceived: '0', unitPrice: '100', vatRate: 20 }],
        invoicedTotal: '1200.00',
        billingStatus: 'FULLY_BILLED',
      }),
    ]);

    expect(report.lines[0].receiptVariance).toBe('-1200.00');
    expect(report.totals[0].notInvoicedTotal).toBe('0.00');
    expect(report.totals[0].notReceivedTotal).toBe('1200.00');
  });

  it('iki yön NETLEŞTİRİLMEZ: aynı para biriminde ikisi de ayrı görünür', () => {
    const report = run([
      order({ id: 'order-1' }),
      order({
        id: 'order-2',
        lines: [{ quantityReceived: '0', unitPrice: '100', vatRate: 20 }],
        invoicedTotal: '1200.00',
      }),
    ]);

    // Netleştirilseydi toplam 0,00 çıkar ve ay sonunda kimse bakmazdı.
    expect(report.totals).toEqual([
      {
        currency: 'TRY',
        notInvoicedTotal: '1200.00',
        notReceivedTotal: '1200.00',
        orderCount: 2,
      },
    ]);
  });

  it('üçlü eşleştirmesi tamamlanmış sipariş rapora GİRMEZ', () => {
    const report = run([
      order({ invoicedTotal: '1200.00', billingStatus: 'FULLY_BILLED' }),
    ]);

    expect(report.lines).toHaveLength(0);
    expect(report.totals).toHaveLength(0);
  });

  it('para birimleri ayrı toplanır (çevirme yapılmaz)', () => {
    const report = run([
      order({ id: 'try-order' }),
      order({
        id: 'usd-order',
        currency: 'USD',
        grandTotal: '240.00',
        lines: [{ quantityReceived: '2', unitPrice: '100', vatRate: 20 }],
      }),
    ]);

    const currencies = report.totals.map((t) => t.currency).sort();
    expect(currencies).toEqual(['TRY', 'USD']);
    expect(
      report.totals.find((t) => t.currency === 'USD')?.notInvoicedTotal
    ).toBe('240.00');
  });

  it('sapması büyük sipariş önce listelenir', () => {
    const report = run([
      order({
        id: 'small',
        lines: [{ quantityReceived: '1', unitPrice: '100', vatRate: 20 }],
      }),
      order({ id: 'big' }),
    ]);

    expect(report.lines.map((l) => l.orderId)).toEqual(['big', 'small']);
  });

  it('kısmi fatura: sapma kalan tutar kadar', () => {
    const report = run([
      order({ invoicedTotal: '500.00', billingStatus: 'PARTIALLY_BILLED' }),
    ]);

    expect(report.lines[0].receiptVariance).toBe('700.00');
    expect(report.lines[0].orderedTotal).toBe('1200.00');
  });

  it('klinik ve asOf rapora taşınır', () => {
    const report = run([order()]);

    expect(report.clinicId).toBe(CLINIC_ID);
    expect(report.asOf).toBe(ASOF);
  });
});
