import { Decimal } from 'decimal.js';
import { FinancialEventTypeSchema } from '@shared';
import { validateFinancialEventPayload } from './financial-event-payload.schemas';

const { enum: T } = FinancialEventTypeSchema;

const paymentReceived = (amount: string) => ({
  method: 'CASH',
  amount,
  partyId: '11111111-1111-4111-8111-111111111111',
});

const SUPPLIER_PARTY = '55555555-5555-4555-8555-555555555555';

describe('validateFinancialEventPayload — kuruş kapısı', () => {
  it('iki ondalık haneye kadar tutar kabul edilir', () => {
    expect(
      validateFinancialEventPayload(T.PAYMENT_RECEIVED, paymentReceived('100'))
    ).toEqual([]);
    expect(
      validateFinancialEventPayload(
        T.PAYMENT_RECEIVED,
        paymentReceived('100.5')
      )
    ).toEqual([]);
    expect(
      validateFinancialEventPayload(
        T.PAYMENT_RECEIVED,
        paymentReceived('100.05')
      )
    ).toEqual([]);
  });

  it('üçüncü ondalık hane reddedilir — fiş satırı 2 haneye yuvarlanıyor', () => {
    // Kabul edilse olay yazılır, posting her satırı `toFixed(2)` ile yazdığı
    // için Σborç = Σalacak bir kuruş kayabilir ve fiş reddedilir. Olay defteri
    // append-only olduğundan gövde düzeltilemez: olay sonsuza dek fişsiz kalır.
    const issues = validateFinancialEventPayload(
      T.PAYMENT_RECEIVED,
      paymentReceived('100.005')
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('amount');
  });

  it('kasa sayım farkı eksi olabilir ama o da kuruş ölçeğindedir', () => {
    const base = {
      bankDepositTotal: '0.00',
      expenseTotal: '0.00',
      currency: 'TRY' as const,
    };

    expect(
      validateFinancialEventPayload(T.CASH_SESSION_CLOSED, {
        ...base,
        difference: '-12.50',
      })
    ).toEqual([]);

    expect(
      validateFinancialEventPayload(T.CASH_SESSION_CLOSED, {
        ...base,
        difference: '-12.505',
      })
    ).toHaveLength(1);
  });

  it('bölünmüş tutarların kuruş toplamı korunur (dengesiz fiş üretilemez)', () => {
    // Üretici tarafın sözleşmesi: her alan `toFixed(2)`. Kapı bunu zorladığı
    // için satırlar ayrı ayrı yuvarlandığında toplam kaymaz.
    const sale = new Decimal('100.00');
    const supplier = new Decimal('89.995').toFixed(2); // 90.00
    const commission = sale.minus(supplier).toFixed(2); // 10.00

    const issues = validateFinancialEventPayload(T.PLATFORM_BOOKING_SETTLED, {
      saleAmount: sale.toFixed(2),
      supplierAmount: supplier,
      commission,
      supplierPartyId: SUPPLIER_PARTY,
      currency: 'EUR',
      bookingType: 'HOTEL',
      provider: 'hotelbeds',
    });

    expect(issues).toEqual([]);
    expect(new Decimal(commission).plus(supplier).toFixed(2)).toBe('100.00');
  });

  describe('rezervasyon tahsilatı/iadesi — tedarikçi carisi ve sıfır tutarlar', () => {
    const refundBase = {
      refundAmount: '120.00',
      commission: '20.00',
      supplierReleased: '100.00',
      retainedLoss: '0.00',
      supplierPartyId: SUPPLIER_PARTY,
      currency: 'EUR',
      bookingType: 'HOTEL',
      provider: 'STRIPE',
    };

    it('tedarikçi carisi eksikse gövde YAZILAMAZ', () => {
      // 320 `requiresParty`: carisiz gövde, append-only deftere postlanamayacak
      // hâlde yazılır ve her süpürmede aynı hatayla patlar. Kapı yazma anında.
      const withoutParty = { ...refundBase };
      delete (withoutParty as Partial<typeof refundBase>).supplierPartyId;

      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, withoutParty)
      ).toHaveLength(1);
      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_SETTLED, {
          saleAmount: '120.00',
          supplierAmount: '100.00',
          commission: '20.00',
          currency: 'EUR',
          bookingType: 'HOTEL',
          provider: 'STRIPE',
        })
      ).toHaveLength(1);
    });

    describe('yabancı para temeli', () => {
      const settledTry = {
        saleAmount: '4200.00',
        supplierAmount: '3500.00',
        commission: '700.00',
        supplierPartyId: SUPPLIER_PARTY,
        currency: 'TRY',
        bookingType: 'HOTEL',
        provider: 'IYZICO',
      };

      it('eksiksiz temel geçerlidir', () => {
        expect(
          validateFinancialEventPayload(T.PLATFORM_BOOKING_SETTLED, {
            ...settledTry,
            originalCurrency: 'EUR',
            fxRate: '35.000000',
            supplierOriginalAmount: '100.00',
          })
        ).toEqual([]);
      });

      it('temel YARIM gelirse gövde yazılamaz', () => {
        // Gövde append-only: kur yazılıp orijinal tutar atlanırsa (ya da tersi)
        // 320 satırının EUR karşılığı bir daha kurtarılamaz.
        expect(
          validateFinancialEventPayload(T.PLATFORM_BOOKING_SETTLED, {
            ...settledTry,
            fxRate: '35.000000',
          })
        ).toHaveLength(1);
        expect(
          validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, {
            ...refundBase,
            originalCurrency: 'EUR',
            fxRate: '35.000000',
            supplierReleasedOriginalAmount: '80.00',
            // retainedLossOriginalAmount eksik → temel yarım
          })
        ).toHaveLength(1);
      });

      it('kur ölçeği altı hane; sıfır/negatif kur reddedilir', () => {
        const withRate = (fxRate: string) =>
          validateFinancialEventPayload(T.PLATFORM_BOOKING_SETTLED, {
            ...settledTry,
            originalCurrency: 'EUR',
            fxRate,
            supplierOriginalAmount: '100.00',
          });

        expect(withRate('35.123456')).toEqual([]);
        expect(withRate('35.1234567')).toHaveLength(1);
        expect(withRate('0')).toHaveLength(1);
        // Negatif kur hem ölçek hem işaret kontrolüne takılır (iki sorun).
        expect(withRate('-35.00').length).toBeGreaterThan(0);
      });
    });

    it('sıfır ceza / sıfır serbest kalan borç geçerlidir, iade tutarı sıfır DEĞİLDİR', () => {
      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, refundBase)
      ).toEqual([]);
      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, {
          ...refundBase,
          supplierReleased: '0.00',
          retainedLoss: '100.00',
        })
      ).toEqual([]);
      // Geri gitmeyen para iade değildir.
      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, {
          ...refundBase,
          refundAmount: '0.00',
        })
      ).toHaveLength(1);
    });

    it('negatif tutar gövdeye giremez (işaretsiz kapı)', () => {
      expect(
        validateFinancialEventPayload(T.PLATFORM_BOOKING_REFUNDED, {
          ...refundBase,
          retainedLoss: '-10.00',
        })
      ).toHaveLength(1);
    });
  });

  it('Value Object / sayı geçirilirse durdurulur (tip kaybı)', () => {
    expect(
      validateFinancialEventPayload(T.PAYMENT_RECEIVED, {
        ...paymentReceived('0'),
        amount: 100 as unknown as string,
      })
    ).toHaveLength(1);
  });

  describe('stok hareketi gövdesi (STOCK_OUT / STOCK_IN)', () => {
    const stockPayload = (overrides: Record<string, unknown> = {}) => ({
      movementId: '11111111-1111-4111-8111-111111111111',
      productId: '22222222-2222-4222-8222-222222222222',
      movementType: 'USAGE',
      quantity: '2.500',
      unitCost: '125.00',
      amount: '312.50',
      ...overrides,
    });

    it('geçerli gövde kabul edilir', () => {
      expect(
        validateFinancialEventPayload(T.STOCK_OUT, stockPayload())
      ).toEqual([]);
      expect(
        validateFinancialEventPayload(
          T.STOCK_IN,
          stockPayload({ movementType: 'ADJUSTMENT' })
        )
      ).toEqual([]);
    });

    it('kuruş altı tutar reddedilir (fiş satırı 2 haneye yuvarlanır)', () => {
      expect(
        validateFinancialEventPayload(
          T.STOCK_OUT,
          stockPayload({ amount: '312.505' })
        )
      ).toHaveLength(1);
    });

    it('sıfır tutar reddedilir (sıfır tutarlı fiş satırı geçersiz)', () => {
      expect(
        validateFinancialEventPayload(
          T.STOCK_OUT,
          stockPayload({ amount: '0.00' })
        )
      ).toHaveLength(1);
    });

    it('miktar en çok 3 ondalık taşır (stok kolonu Decimal(10,3))', () => {
      expect(
        validateFinancialEventPayload(
          T.STOCK_OUT,
          stockPayload({ quantity: '2.5005' })
        )
      ).toHaveLength(1);
    });

    it('hareket kimliği olmadan yazılamaz (izlenebilirlik)', () => {
      expect(
        validateFinancialEventPayload(
          T.STOCK_OUT,
          stockPayload({ movementId: undefined })
        )
      ).toHaveLength(1);
    });
  });
});

/**
 * Yöntem kapısı: kabul kümesi posting kuralının hesap eşlemesiyle **aynı**
 * sabitten gelir. `z.string()` iken kapı kullanım yerinden çok daha genişti ve
 * eşlemesi olmayan yöntem sessizce 102 Bankalar'a yazılıyordu (CLAUDE.md finans
 * kuralı 12).
 */
describe('validateFinancialEventPayload — ödeme yöntemi kapısı', () => {
  const base = {
    amount: '100.00',
    partyId: '11111111-1111-4111-8111-111111111111',
  };

  it('tahsilatta nakit / havale / kart kabul edilir', () => {
    for (const method of ['CASH', 'BANK_TRANSFER', 'POS_CARD']) {
      expect(
        validateFinancialEventPayload(T.PAYMENT_RECEIVED, { ...base, method })
      ).toEqual([]);
    }
  });

  it('tahsilatta tanınmayan yöntem reddedilir', () => {
    const issues = validateFinancialEventPayload(T.PAYMENT_RECEIVED, {
      ...base,
      method: 'CHECK',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('method');
  });

  it('ödemede kart reddedilir (108 kart ALACAĞIMIZDIR)', () => {
    const issues = validateFinancialEventPayload(T.PAYMENT_MADE, {
      ...base,
      method: 'POS_CARD',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('method');
  });

  it('ödemede nakit / havale kabul edilir', () => {
    for (const method of ['CASH', 'BANK_TRANSFER']) {
      expect(
        validateFinancialEventPayload(T.PAYMENT_MADE, { ...base, method })
      ).toEqual([]);
    }
  });

  it('İADEDE kart kabul edilir — para geldiği enstrümandan geri gider', () => {
    // `PAYMENT_MADE` kümesi (satıcıya ödeme) bilinçli olarak kart taşımıyor;
    // iade o kümeyi kullansaydı her kart iadesi "tanınmayan yöntem" diye
    // reddedilir ve iade defterine hiç yazılamazdı.
    for (const method of ['CASH', 'BANK_TRANSFER', 'POS_CARD']) {
      expect(
        validateFinancialEventPayload(T.PAYMENT_REFUNDED, { ...base, method })
      ).toEqual([]);
    }
  });

  it('iadede tanınmayan yöntem reddedilir', () => {
    const issues = validateFinancialEventPayload(T.PAYMENT_REFUNDED, {
      ...base,
      method: 'CHECK',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('method');
  });

  it('iade tutarı sıfır olamaz (sıfır tutarlı ters kayıt anlamsız)', () => {
    const issues = validateFinancialEventPayload(T.PAYMENT_REFUNDED, {
      ...base,
      amount: '0.00',
      method: 'POS_CARD',
    });

    expect(issues).toHaveLength(1);
  });
});
