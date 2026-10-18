import { PurchaseInvoice } from './purchase-invoice.entity';
import {
  PurchaseInvoiceCancelledEvent,
  PurchaseInvoiceRecordedEvent,
} from '@modules/finance/purchase-invoice/domain/events';
import {
  PurchaseInvoiceAlreadyCancelledException,
  PurchaseInvoiceAlreadyMatchedException,
  PurchaseInvoiceInvalidDateException,
  PurchaseInvoiceInvalidPrecisionException,
  PurchaseInvoiceNotMatchableException,
  PurchaseInvoiceNotMatchedException,
  PurchaseInvoiceNotUnmatchableException,
  PurchaseInvoiceUnbalancedTotalsException,
  PurchaseInvoiceVatMismatchException,
} from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import { InvalidVatRateException } from '@src/domain/exceptions';
import { CreatePurchaseInvoiceProps } from '@modules/finance/purchase-invoice/domain/contracts/purchase-invoice';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * Alış faturasının **kendi** değişmez kuralları (§13 P1-1, P1-2, P1-3, P1-4).
 * Kurallar entity'de durur: belge dışarıdan gelir, tutarları kullanıcı girer ve
 * entity'yi kullanan her yol (HTTP komutu, içe aktarma, script) aynı kapıdan geçer.
 */
describe('PurchaseInvoice (alış faturası değişmez kuralları)', () => {
  const baseProps = (
    overrides: Partial<CreatePurchaseInvoiceProps> = {}
  ): CreatePurchaseInvoiceProps => ({
    id: UUID.generate().value,
    clinicId: UUID.generate().value,
    organizationId: UUID.generate().value,
    supplierId: UUID.generate().value,
    invoiceNumber: 'TDR-2026-001',
    invoiceDate: new Date('2026-05-01'),
    lineAccountCode: '770',
    vatRate: 20,
    netTotal: '1000.00',
    vatTotal: '200.00',
    grandTotal: '1200.00',
    currency: 'TRY',
    ...overrides,
  });

  it('geçerli belge kaydedilir ve RECORDED durumuyla doğar', () => {
    const invoice = PurchaseInvoice.create(baseProps());

    expect(invoice.status).toBe('RECORDED');
    expect(invoice.netTotal.toApiFormat()).toBe('1000.00');
    expect(invoice.vatTotal.toApiFormat()).toBe('200.00');
    expect(invoice.grandTotal.toApiFormat()).toBe('1200.00');
    expect(invoice.isMatched).toBe(false);
  });

  // --- P1-1: denge ---

  it('genel toplam net + KDV toplamına eşit değilse reddedilir', () => {
    // Dengesiz fatura posting'de UnbalancedJournalEntryException ile patlar ve
    // olay yazılmış olduğu için fiş KALICI olarak üretilemez.
    expect(() =>
      PurchaseInvoice.create(baseProps({ grandTotal: '1500.00' }))
    ).toThrow(PurchaseInvoiceUnbalancedTotalsException);
  });

  // --- P1-2: KDV ↔ oran tutarlılığı ---

  it('KDV tutarı KDV oranıyla uyuşmuyorsa reddedilir', () => {
    // Defter dengeli görünür (grand = net + vat) ama 191 indirilecek KDV ve
    // KDV beyanı yanlış olur — hata sessiz kalır.
    expect(() =>
      PurchaseInvoice.create(
        baseProps({ vatTotal: '1.00', grandTotal: '1001.00' })
      )
    ).toThrow(PurchaseInvoiceVatMismatchException);
  });

  it('matrah yuvarlamasından doğan 1 kuruşluk sapma kabul edilir', () => {
    // net × %20 = 33.333 → 33.33; tedarikçi belgesinde 33.34 basılıysa reddedilmez.
    const invoice = PurchaseInvoice.create(
      baseProps({
        vatRate: 20,
        netTotal: '166.67',
        vatTotal: '33.34',
        grandTotal: '200.01',
      })
    );

    expect(invoice.vatTotal.toApiFormat()).toBe('33.34');
  });

  it('çok satırlı tedarikçi belgesi kabul edilir — sabit 1 kuruşluk tavan bunu REDDEDİYORDU (P0)', () => {
    // Tedarikçinin belgesi satır bazında yuvarlanmış: 10 satır × 33,33 @ %20 →
    // satır KDV toplamı 66,70, matrah × oran ise 66,66 (4 kuruş sapma). Bu model
    // satır tutmaz, belge bizim için bir **dış olgudur**; sabit 1 kuruşluk tavan
    // gerçek faturanın hiç kaydedilememesine yol açıyordu.
    const invoice = PurchaseInvoice.create(
      baseProps({
        vatRate: 20,
        netTotal: '333.30',
        vatTotal: '66.70',
        grandTotal: '400.00', // denge kuralı: genel toplam = net + KDV
      })
    );

    expect(invoice.vatTotal.toApiFormat()).toBe('66.70');
  });

  it('küçük tutarda kuruş TABANI korur (oransal tavan tek başına reddederdi)', () => {
    // net 1,00 @ %20 → beklenen 0,20; oransal pay yalnız 0,005 olurdu.
    // Tedarikçi 0,21 basmışsa 1 kuruşluk taban bunu kurtarır.
    const invoice = PurchaseInvoice.create(
      baseProps({
        vatRate: 20,
        netTotal: '1.00',
        vatTotal: '0.21',
        grandTotal: '1.21',
      })
    );

    expect(invoice.vatTotal.toApiFormat()).toBe('0.21');
  });

  it('yanlış oran seçimi hâlâ reddedilir (yasal oran aralığı toleransın iki katı)', () => {
    // %20 seçilmiş ama tutarlar %10'u ima ediyor: sapma 100,00 > pay 5,00.
    // Yasal oranlar {0,1,10,20} olduğundan en küçük karışıklık 1 oran puanıdır,
    // tolerans ise 0,5 puan — her karışıklık iki tavanı da aşar.
    expect(() =>
      PurchaseInvoice.create(
        baseProps({ vatTotal: '100.00', grandTotal: '1100.00' })
      )
    ).toThrow(PurchaseInvoiceVatMismatchException);
  });

  it('KDV oranı yasal kümede değilse reddedilir (%8)', () => {
    expect(() =>
      PurchaseInvoice.create(
        baseProps({ vatRate: 8, vatTotal: '80.00', grandTotal: '1080.00' })
      )
    ).toThrow(InvalidVatRateException);
  });

  it('KDV oranı 0 olan belge (istisna/muafiyet) kabul edilir', () => {
    const invoice = PurchaseInvoice.create(
      baseProps({ vatRate: 0, vatTotal: '0.00', grandTotal: '1000.00' })
    );

    expect(invoice.vatRate.isZero()).toBe(true);
  });

  // --- P1-3: kuruş hassasiyeti ---

  it('kuruş altı tutar reddedilir (DB yuvarlaması dengeyi bozar)', () => {
    expect(() =>
      PurchaseInvoice.create(
        baseProps({
          vatRate: 20,
          netTotal: '100.005',
          vatTotal: '20.001',
          grandTotal: '120.006',
        })
      )
    ).toThrow(PurchaseInvoiceInvalidPrecisionException);
  });

  // --- P1-4: belge tarihi ---

  it('gelecek tarihli fatura reddedilir', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    expect(() =>
      PurchaseInvoice.create(baseProps({ invoiceDate: tomorrow }))
    ).toThrow(PurchaseInvoiceInvalidDateException);
  });

  // --- P1-5: audit damgası ---

  it('kayıt olayı entity içinde raise edilir (kim/ne zaman izi)', () => {
    const invoice = PurchaseInvoice.create(
      baseProps({ actorId: 'user-1', source: undefined })
    );

    const events = invoice.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as PurchaseInvoiceRecordedEvent;
    expect(event).toBeInstanceOf(PurchaseInvoiceRecordedEvent);
    expect(event.purchaseInvoiceId).toBe(invoice.id.value);
    expect(event.grandTotal).toBe('1200.00');
    expect(event.log?.actorId).toBe('user-1');
  });

  // --- Sipariş eşleştirme guard'ları ---

  it('zaten eşleştirilmiş fatura yeniden eşleştirilemez', () => {
    const orderId = UUID.generate().value;
    const invoice = PurchaseInvoice.create(
      baseProps({ purchaseOrderId: orderId })
    );

    expect(() => invoice.matchToOrder(UUID.generate().value)).toThrow(
      PurchaseInvoiceAlreadyMatchedException
    );
  });

  it('eşleştirilmemiş faturanın bağı koparılamaz', () => {
    const invoice = PurchaseInvoice.create(baseProps());

    expect(() => invoice.unmatchFromOrder()).toThrow(
      PurchaseInvoiceNotMatchedException
    );
  });

  it('eşleştirme kurulup koparıldığında önceki sipariş döner', () => {
    const orderId = UUID.generate().value;
    const invoice = PurchaseInvoice.create(baseProps());

    invoice.matchToOrder(orderId);
    expect(invoice.isMatched).toBe(true);

    expect(invoice.unmatchFromOrder()).toBe(orderId);
    expect(invoice.isMatched).toBe(false);
  });
});

/**
 * Alış faturası iptali (storno): belge yerinde kalır, CANCELLED damgalanır, iz
 * (kim/ne zaman/neden) bırakır. Sipariş bağı korunur — sayaç komut tarafında
 * düşülür, bu yüzden `unmatchFromOrder` iptal sonrası reddedilir.
 */
describe('PurchaseInvoice.cancel (iptal / storno)', () => {
  const baseProps = (
    overrides: Partial<CreatePurchaseInvoiceProps> = {}
  ): CreatePurchaseInvoiceProps => ({
    id: UUID.generate().value,
    clinicId: UUID.generate().value,
    organizationId: UUID.generate().value,
    supplierId: UUID.generate().value,
    invoiceNumber: 'TDR-2026-900',
    invoiceDate: new Date('2026-05-01'),
    lineAccountCode: '770',
    vatRate: 20,
    netTotal: '1000.00',
    vatTotal: '200.00',
    grandTotal: '1200.00',
    currency: 'TRY',
    ...overrides,
  });

  const cancelProps = {
    reason: 'Tedarikçi belgeyi iptal etti',
    cancelledById: 'firebase-uid-1',
  };

  const recorded = (overrides: Partial<CreatePurchaseInvoiceProps> = {}) => {
    const invoice = PurchaseInvoice.create(baseProps(overrides));
    invoice.clearDomainEvents();
    return invoice;
  };

  it('CANCELLED yapar, damgayı yazar ve iptal olayını fırlatır', () => {
    const invoice = recorded();

    invoice.cancel(cancelProps);

    expect(invoice.status).toBe('CANCELLED');
    expect(invoice.isCancelled).toBe(true);
    expect(invoice.cancelledAt).toBeInstanceOf(Date);
    expect(invoice.cancelledById).toBe('firebase-uid-1');
    expect(invoice.cancelReason).toBe('Tedarikçi belgeyi iptal etti');

    const events = invoice.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PurchaseInvoiceCancelledEvent);
  });

  it('sipariş bağı korunur (hangi siparişin faturası iptal edildi izlenebilsin)', () => {
    const orderId = UUID.generate().value;
    const invoice = recorded({ purchaseOrderId: orderId });

    invoice.cancel(cancelProps);

    expect(invoice.purchaseOrderId).toBe(orderId);
    expect(invoice.toPersistence().purchaseOrderId).toBe(orderId);
  });

  it('ikinci iptal reddedilir (mükerrer storno + çift sayaç düşümü)', () => {
    const invoice = recorded();
    invoice.cancel(cancelProps);

    expect(() => invoice.cancel(cancelProps)).toThrow(
      PurchaseInvoiceAlreadyCancelledException
    );
  });

  it('iptal edilmiş faturanın eşleştirmesi ayrıca kaldırılamaz (çift düşüm)', () => {
    const invoice = recorded({ purchaseOrderId: UUID.generate().value });
    invoice.cancel(cancelProps);

    expect(() => invoice.unmatchFromOrder()).toThrow(
      PurchaseInvoiceNotUnmatchableException
    );
  });

  it('iptal edilmiş fatura siparişe eşleştirilemez', () => {
    const invoice = recorded();
    invoice.cancel(cancelProps);

    expect(() => invoice.matchToOrder(UUID.generate().value)).toThrow(
      PurchaseInvoiceNotMatchableException
    );
  });

  it('iptal, toPersistence ile damgaları taşır (mapping kaybı sessiz veri kaybıdır)', () => {
    const invoice = recorded();
    invoice.cancel(cancelProps);

    const persisted = invoice.toPersistence();
    expect(persisted.status).toBe('CANCELLED');
    expect(persisted.cancelledAt).toBeInstanceOf(Date);
    expect(persisted.cancelledById).toBe('firebase-uid-1');
    expect(persisted.cancelReason).toBe('Tedarikçi belgeyi iptal etti');
  });
});
