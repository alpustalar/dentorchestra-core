import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { ProviderSettlement } from './provider-settlement.entity';
import {
  SettlementAmountMismatchException,
  SettlementInvalidAmountException,
  SettlementInvalidPrecisionException,
  SettlementReferenceRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import CurrencySchema from '@input-type-schemas/CurrencySchema';
import SettlementProviderSchema from '@input-type-schemas/SettlementProviderSchema';

/**
 * Hesap kapamasının tek iç değişmezi **brüt = net + komisyon**: bu eşitlik fişin
 * dengesidir (`B 102 net + B 653 komisyon / A 108 brüt`). Tolerans yok — tutar
 * bizim hesabımız değil, sağlayıcının kendi payout raporu.
 */
describe('ProviderSettlement', () => {
  const CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';

  const record = (over: Partial<Record<string, unknown>> = {}) =>
    ProviderSettlement.record({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      provider: SettlementProviderSchema.enum.IYZICO,
      reference: 'PAYOUT-2026-10-15-001',
      payoutDate: new Date('2026-10-15T00:00:00.000Z'),
      grossAmount: new Decimal('10000.00'),
      commissionAmount: new Decimal('185.00'),
      netAmount: new Decimal('9815.00'),
      currency: CurrencySchema.enum.TRY,
      recordedById: ACTOR_ID,
      ...over,
    });

  it('tutarlar tutarlıysa kayıt doğar ve henüz fişlenmemiştir', () => {
    const settlement = record();

    expect(settlement.grossAmount.toFixed(2)).toBe('10000.00');
    expect(settlement.isPostedToAccounting()).toBe(false);
    expect(settlement.accountingEventId).toBeNull();
  });

  it('brüt ≠ net + komisyon reddedilir ve üç tutarı birlikte taşır', () => {
    try {
      record({ commissionAmount: new Decimal('100.00') });
      throw new Error('beklenen hata fırlatılmadı');
    } catch (error) {
      expect(error).toBeInstanceOf(SettlementAmountMismatchException);
      expect((error as SettlementAmountMismatchException).meta).toEqual({
        grossAmount: '10000.00',
        netAmount: '9815.00',
        commissionAmount: '100.00',
      });
    }
  });

  it('komisyonsuz payout geçerlidir (brüt = net)', () => {
    const settlement = record({
      commissionAmount: new Decimal(0),
      netAmount: new Decimal('10000.00'),
    });

    expect(settlement.commissionAmount.isZero()).toBe(true);
  });

  it('negatif komisyon reddedilir', () => {
    // Sağlayıcı para EKLEYEMEZ; eklediği bir durum varsa o ayrı bir ekonomik
    // olaydır ve bu kayda sığdırılamaz.
    expect(() =>
      record({
        commissionAmount: new Decimal('-10.00'),
        netAmount: new Decimal('10010.00'),
      })
    ).toThrow(SettlementInvalidAmountException);
  });

  it('sıfır brüt/net reddedilir', () => {
    expect(() =>
      record({
        grossAmount: new Decimal(0),
        netAmount: new Decimal(0),
        commissionAmount: new Decimal(0),
      })
    ).toThrow(SettlementInvalidAmountException);
  });

  it('kuruştan ince tutar reddedilir', () => {
    // DB kolonu `Decimal(14,2)`: üçüncü basamak sessizce yuvarlanır ve eşitlik
    // — yani fişin dengesi — saklanırken bozulur (§81.3).
    expect(() =>
      record({
        grossAmount: new Decimal('10000.005'),
        netAmount: new Decimal('9815.005'),
        commissionAmount: new Decimal('185.00'),
      })
    ).toThrow(SettlementInvalidPrecisionException);
  });

  it('boş referans reddedilir (idempotency anahtarının yarısı)', () => {
    expect(() => record({ reference: '   ' })).toThrow(
      SettlementReferenceRequiredException
    );
  });

  it('referansın baş/son boşlukları kırpılır', () => {
    expect(record({ reference: '  PAYOUT-1  ' }).reference).toBe('PAYOUT-1');
  });

  it('fiş damgası iz bırakır', () => {
    const settlement = record();
    const eventId = randomUUID();

    settlement.markAsPostedToAccounting({ accountingEventId: eventId });

    expect(settlement.isPostedToAccounting()).toBe(true);
    expect(settlement.accountingEventId).toBe(eventId);
    expect(settlement.postedToAccountingAt).not.toBeNull();
  });

  it('toPersistence tüm para kolonlarını taşır', () => {
    // §9: mapping'de alan düşmesi sessiz veri kaybıdır.
    const raw = record().toPersistence();

    expect(Object.keys(raw)).toEqual(
      expect.arrayContaining([
        'grossAmount',
        'commissionAmount',
        'netAmount',
        'currency',
        'provider',
        'reference',
        'payoutDate',
        'bankAccountId',
        'accountingEventId',
        'recordedById',
      ])
    );
  });
});
