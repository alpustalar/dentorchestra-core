import { Decimal } from 'decimal.js';
import { PurchaseOrder } from './purchase-order.entity';
import {
  PurchaseOrderCancelWithInvoicesException,
  PurchaseOrderNotBillableException,
  PurchaseOrderOverInvoicedException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import { buildMatchSummary } from '@modules/supply/purchasing/domain/rules/purchase-order-billing.rules';

/**
 * Fatura eşleştirmenin asıl işi, sipariş edilenden fazlasının faturalanmasını
 * engellemektir. Kümülatif olması şart: her faturaya tek tek bakan bir kontrol
 * art arda gelen iki tam faturayı da geçirir.
 */
describe('PurchaseOrder — fatura eşleştirme (3-way match)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';
  const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

  /** 10 × 100 TL + %20 KDV = 1200 TL'lik gönderilmiş sipariş. */
  const makeSentOrder = (): PurchaseOrder => {
    const order = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [
        {
          productId: PRODUCT_ID,
          description: 'Eldiven',
          quantity: 10,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
    });
    order.send();
    return order;
  };

  it('yeni sipariş faturalanmamış başlar', () => {
    const order = makeSentOrder();

    expect(order.grandTotal.toNumber()).toBe(1200);
    expect(order.invoicedTotal.toNumber()).toBe(0);
    expect(order.billingStatus).toBe('NOT_BILLED');
    expect(order.remainingToInvoice.toNumber()).toBe(1200);
  });

  it('kısmi fatura PARTIALLY_BILLED yapar ve kalanı düşürür', () => {
    const order = makeSentOrder();

    order.applyInvoice(new Decimal(480));

    expect(order.invoicedTotal.toNumber()).toBe(480);
    expect(order.billingStatus).toBe('PARTIALLY_BILLED');
    expect(order.remainingToInvoice.toNumber()).toBe(720);
  });

  it('toplam sipariş tutarına ulaşınca FULLY_BILLED olur', () => {
    const order = makeSentOrder();

    order.applyInvoice(new Decimal(480));
    order.applyInvoice(new Decimal(720));

    expect(order.invoicedTotal.toNumber()).toBe(1200);
    expect(order.billingStatus).toBe('FULLY_BILLED');
    expect(order.remainingToInvoice.toNumber()).toBe(0);
  });

  it('kümülatif toplam sipariş tutarını aşamaz', () => {
    const order = makeSentOrder();
    order.applyInvoice(new Decimal(1000));

    // Tek tek bakan bir kontrol bunu geçirirdi (300 < 1200); kümülatif olan geçirmez.
    expect(() => order.applyInvoice(new Decimal(300))).toThrow(
      PurchaseOrderOverInvoicedException
    );
    expect(order.invoicedTotal.toNumber()).toBe(1000);
  });

  it('aşım hatası sipariş/teslim/fatura tutarlarını meta ile taşır', () => {
    const order = makeSentOrder();
    order.receive([{ itemId: order.lines[0].id, quantity: 4 }], {
      receivedById: null,
    });
    order.applyInvoice(new Decimal(1000));

    try {
      order.applyInvoice(new Decimal(500));
      fail('aşım hatası bekleniyordu');
    } catch (error) {
      const meta = (error as PurchaseOrderOverInvoicedException).meta;
      expect(meta).toEqual({
        orderId: order.id.value,
        orderedTotal: 1200,
        receivedValue: 480, // 4 × 100 + %20
        alreadyInvoiced: 1000,
        attempted: 500,
      });
    }
  });

  it('taslak siparişe fatura eşleştirilemez', () => {
    const draft = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [{ description: 'Danışmanlık', quantity: 1, unitPrice: 500 }],
    });

    expect(() => draft.applyInvoice(new Decimal(100))).toThrow(
      PurchaseOrderNotBillableException
    );
  });

  it('iptal edilmiş siparişe fatura eşleştirilemez', () => {
    const order = makeSentOrder();
    order.cancel();

    expect(() => order.applyInvoice(new Decimal(100))).toThrow(
      PurchaseOrderNotBillableException
    );
  });

  it('mal gelmeden faturalama ENGELLENMEZ — sapma olarak raporlanır', () => {
    const order = makeSentOrder(); // hiç teslim alınmadı

    order.applyInvoice(new Decimal(1200));

    expect(order.billingStatus).toBe('FULLY_BILLED');
    expect(order.receivedValue.toNumber()).toBe(0);
  });

  it('eşleştirme kaldırıldığında sayaç ve durum geri döner', () => {
    const order = makeSentOrder();
    order.applyInvoice(new Decimal(1200));

    order.revertInvoice(new Decimal(1200));

    expect(order.invoicedTotal.toNumber()).toBe(0);
    expect(order.billingStatus).toBe('NOT_BILLED');
  });

  it('işlenmiş toplamdan fazlası geri alınamaz (sessiz kırpma yok)', () => {
    const order = makeSentOrder();
    order.applyInvoice(new Decimal(300));

    expect(() => order.revertInvoice(new Decimal(500))).toThrow();
    expect(order.invoicedTotal.toNumber()).toBe(300);
  });

  it('özet, sipariş/teslim/fatura üçlüsünü ve sapmayı verir', () => {
    const order = makeSentOrder();
    order.receive([{ itemId: order.lines[0].id, quantity: 6 }], {
      receivedById: null,
    });
    order.applyInvoice(new Decimal(480));

    // Okuma tarafı entity kurmaz; aynı saf fonksiyonu okuma modeliyle çağırır.
    const summary = buildMatchSummary({
      grandTotal: order.grandTotal,
      invoicedTotal: order.invoicedTotal,
      billingStatus: order.billingStatus,
      lines: order.lines,
    });

    // Tutarlar kuruş ölçeğinde **string**: okuma modeli para alanlarını JSON'a
    // kayan nokta olarak vermez (finans okuma modellerinin tamamıyla aynı).
    expect(summary).toEqual({
      orderedTotal: '1200.00',
      receivedValue: '720.00', // 6 × 100 + %20
      invoicedTotal: '480.00',
      remainingToInvoice: '720.00',
      receiptVariance: '240.00', // mal geldi, faturası gelmedi
      billingStatus: 'PARTIALLY_BILLED',
    });
  });

  describe('iptal ile fatura sayacı', () => {
    it('faturası eşleşmiş sipariş iptal edilemez', () => {
      // Fatura eşleştirme SENT durumunda da yapılabiliyor. Sayacı dolu bir
      // siparişi iptal etmek, iptal edilmiş bir siparişe bağlı borç bırakır:
      // `applyInvoice` artık reddedildiği için sayaç bir daha doğru değere
      // getirilemez ve üçlü eşleştirme o sipariş için kalıcı anlamsızlaşır.
      const order = makeSentOrder();
      order.applyInvoice(new Decimal(480));

      expect(() => order.cancel()).toThrow(
        PurchaseOrderCancelWithInvoicesException
      );
      expect(order.status).toBe('SENT');
    });

    it('eşleştirme kaldırıldıktan sonra iptal edilebilir', () => {
      const order = makeSentOrder();
      order.applyInvoice(new Decimal(480));
      order.revertInvoice(new Decimal(480));

      order.cancel();

      expect(order.status).toBe('CANCELLED');
      expect(order.billingStatus).toBe('NOT_BILLED');
    });

    it('hiç faturalanmamış sipariş doğrudan iptal edilir', () => {
      const order = makeSentOrder();

      order.cancel();

      expect(order.status).toBe('CANCELLED');
    });
  });
});
