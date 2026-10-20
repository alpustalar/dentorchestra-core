import { Decimal } from 'decimal.js';
import { PurchaseOrder } from './purchase-order.entity';
import {
  PurchaseOrderInvalidReceiptQuantityException,
  PurchaseOrderOverReceiptException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';

/**
 * Mal kabul **günlüğü**: her kabul, sayacı ilerleten çağrıyla AYNI çağrıda kendi kaydını
 * bırakır. Sayaç (`quantityReceived`) tarih taşımaz; "31 Aralık itibarıyla teslim alınan"
 * sorusu yalnız günlükten cevaplanır ve geriye dönük üretilemez.
 */
describe('PurchaseOrder — mal kabul günlüğü', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';
  const ACTOR = 'firebase-uid-1';

  /** Gönderilmiş sipariş: A 10 adet × 100, B 5 adet × 40. */
  const makeSentOrder = (): PurchaseOrder => {
    const order = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [
        { description: 'A', quantity: 10, unitPrice: 100, vatRate: 20 },
        { description: 'B', quantity: 5, unitPrice: 40, vatRate: 10 },
      ],
    });
    order.send();
    return order;
  };

  it('her kabul tek günlük kaydı + kalem başına satır üretir', () => {
    const order = makeSentOrder();
    const [a, b] = order.lines;

    order.receive(
      [
        { itemId: a.id, quantity: 4 },
        { itemId: b.id, quantity: 5 },
      ],
      { receivedById: ACTOR }
    );

    expect(order.pendingReceipts).toHaveLength(1);
    const receipt = order.pendingReceipts[0];
    expect(receipt).toMatchObject({
      orderId: order.id.value,
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      receivedById: ACTOR,
      source: 'GOODS_RECEIPT',
    });
    expect(receipt.receivedAt).toBeInstanceOf(Date);
    expect(receipt.lines).toHaveLength(2);
    expect(receipt.lines.map((l) => [l.itemId, l.quantity.toString()])).toEqual(
      [
        [a.id, '4'],
        [b.id, '5'],
      ]
    );
  });

  it('satır, kabul anındaki birim fiyatın anlık görüntüsünü taşır', () => {
    const order = makeSentOrder();
    const [a] = order.lines;

    order.receive([{ itemId: a.id, quantity: 2 }], { receivedById: null });

    // GRNI tutarı (miktar × fiyat) günlükten hesaplanır; kalemin sonraki hali geçmiş
    // bir yılın tahakkukunu oynatamaz.
    expect(order.pendingReceipts[0].lines[0].unitPrice.toString()).toBe('100');
  });

  it('günlük toplamı sayaçla eşit ilerler (çok kabul)', () => {
    const order = makeSentOrder();
    const [a] = order.lines;

    order.receive([{ itemId: a.id, quantity: 3 }], { receivedById: ACTOR });
    order.receive([{ itemId: a.id, quantity: 4 }], { receivedById: ACTOR });

    const journalTotal = order.pendingReceipts
      .flatMap((r) => r.lines)
      .filter((l) => l.itemId === a.id)
      .reduce((sum, l) => sum.plus(l.quantity), new Decimal(0));

    expect(order.pendingReceipts).toHaveLength(2);
    expect(journalTotal.toNumber()).toBe(7);
    expect(order.getLine(a.id)?.quantityReceived.toNumber()).toBe(7);
  });

  it('reddedilen kabul günlüğe kayıt bırakmaz (aşırı teslim)', () => {
    const order = makeSentOrder();
    const [a] = order.lines;

    expect(() =>
      order.receive([{ itemId: a.id, quantity: 11 }], { receivedById: ACTOR })
    ).toThrow(PurchaseOrderOverReceiptException);

    expect(order.pendingReceipts).toHaveLength(0);
  });

  it.each([0, -1, Number.NaN])(
    'sıfır / negatif / sayı olmayan miktar (%s) reddedilir',
    (quantity) => {
      const order = makeSentOrder();

      expect(() =>
        order.receive([{ itemId: order.lines[0].id, quantity }], {
          receivedById: ACTOR,
        })
      ).toThrow(PurchaseOrderInvalidReceiptQuantityException);
      expect(order.pendingReceipts).toHaveLength(0);
    }
  );

  it('kimliksiz (sistem) kabul açıkça null yazılır', () => {
    const order = makeSentOrder();
    order.receive([{ itemId: order.lines[0].id, quantity: 1 }], {
      receivedById: null,
    });

    expect(order.pendingReceipts[0].receivedById).toBeNull();
  });

  it('clearPendingReceipts kalıcılaştırılan kayıtları boşaltır', () => {
    const order = makeSentOrder();
    order.receive([{ itemId: order.lines[0].id, quantity: 1 }], {
      receivedById: ACTOR,
    });

    order.clearPendingReceipts();

    expect(order.pendingReceipts).toHaveLength(0);
  });
});
