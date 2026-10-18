import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { PlatformBookingSettledRule } from './platform-booking-settled.rule';
import { PlatformBookingSettledEventPayload } from '../event-payloads';
import {
  PlatformBookingAmountsMismatchException,
  PlatformBookingBelowCostException,
} from '../../exceptions/posting.exceptions';

const OCCURRED_AT = new Date('2026-08-08T10:00:00Z');

const buildEvent = (
  payload: Partial<PlatformBookingSettledEventPayload> = {}
): FinancialEvent =>
  ({
    occurredAt: OCCURRED_AT,
    payload: {
      saleAmount: '1200.00',
      supplierAmount: '1000.00',
      commission: '200.00',
      supplierPartyId: '55555555-5555-4555-8555-555555555555',
      currency: 'EUR',
      bookingType: 'HOTEL',
      provider: 'STRIPE',
      ...payload,
    },
  }) as unknown as FinancialEvent;

describe('PlatformBookingSettledRule', () => {
  const rule = new PlatformBookingSettledRule();

  it('aracı (net) yaklaşımı: hasılat yalnız komisyon, tedarikçi payı borç', () => {
    const entry = rule.build(buildEvent());

    const byAccount = Object.fromEntries(
      entry.lines.map((l) => [l.accountCode, l])
    );

    // Tahsilat sağlayıcıda yolda.
    expect(byAccount['108'].debit).toBe('1200.00');
    // Platform geliri SADECE komisyon — brüt yazılsaydı ciro tedarikçi payı
    // kadar şişerdi.
    expect(byAccount['601'].credit).toBe('200.00');
    // Tedarikçi payı hasılat değil, HotelBeds'e borç.
    expect(byAccount['320'].credit).toBe('1000.00');
    // 320 `requiresParty` taşır: cari olmadan fiş posting handler'da reddedilir
    // ve tahsilat defteri HİÇ yazılmaz. Kuralın birim testi bunu görmediği için
    // boşluk aylarca sessiz kalmıştı (§67).
    expect(byAccount['320'].partyId).toBe(
      '55555555-5555-4555-8555-555555555555'
    );
  });

  it('fiş denk: borç toplamı = alacak toplamı', () => {
    const entry = rule.build(buildEvent());

    const debit = entry.lines.reduce(
      (sum, l) => sum.plus(l.debit ?? 0),
      new Decimal(0)
    );
    const credit = entry.lines.reduce(
      (sum, l) => sum.plus(l.credit ?? 0),
      new Decimal(0)
    );

    expect(debit.toFixed(2)).toBe('1200.00');
    expect(debit.equals(credit)).toBe(true);
  });

  it('tutarlar tutarsızsa fiş üretmez — dengesiz kayıt mizanı bozmasın', () => {
    // komisyon + tedarikçi ≠ brüt (bir kuruş sapma)
    const event = buildEvent({ commission: '199.99' });

    expect(() => rule.build(event)).toThrow(
      PlatformBookingAmountsMismatchException
    );
  });

  it('satış para birimini taşır — çevrimi posting yapar (Model A)', () => {
    const entry = rule.build(buildEvent({ currency: 'USD' }));

    expect(entry.currency).toBe('USD');
  });

  it('olayın tarihi fişin tarihidir', () => {
    const entry = rule.build(buildEvent());

    expect(entry.date).toBe(OCCURRED_AT);
  });

  it('rezervasyon türü fiş açıklamasına geçer', () => {
    const entry = rule.build(buildEvent({ bookingType: 'TRANSFER' }));

    expect(entry.description).toContain('TRANSFER');
  });

  it('maliyetin ALTINDA satışta fiş üretmez — negatif hasılat satırı yazılmaz', () => {
    // Sağlayıcı rezervasyonu teklifte söylediğinden pahalıya açtıysa (komisyon
    // oranını aşan bir zam) komisyon negatife düşer. Denge kontrolü bunu
    // YAKALAMAZ: sale − supplier her zaman denk gelir. 601'e negatif alacak
    // yazmak hasılatı ters işaretle gösterirdi; zararın hangi hesapta tanınacağı
    // muhasebe kararı → olay postlanmamış kalır ve insana taşınır.
    const event = buildEvent({
      saleAmount: '1000.00',
      supplierAmount: '1050.00',
      commission: '-50.00',
    });

    expect(() => rule.build(event)).toThrow(PlatformBookingBelowCostException);
  });

  it('komisyonsuz satışta (maliyetine) yalnız tedarikçi borcu doğar', () => {
    const entry = rule.build(
      buildEvent({
        saleAmount: '1000.00',
        supplierAmount: '1000.00',
        commission: '0.00',
      })
    );

    const revenue = entry.lines.find((l) => l.accountCode === '601');
    expect(revenue?.credit).toBe('0.00');
  });

  describe('satır-seviyesi yabancı para temeli', () => {
    it('320 satırı orijinal tutarı + kilitli kuru taşır (gövde TRY olsa bile)', () => {
      // Para TRY girdi (iyzico) ama borç sağlayıcıya EUR doğdu. TRY tutarı tek
      // başına yazılırsa tedarikçi mutabakatı kendi cinsinden yapılamaz.
      const entry = rule.build(
        buildEvent({
          currency: 'TRY',
          saleAmount: '4200.00',
          supplierAmount: '3500.00',
          commission: '700.00',
          originalCurrency: 'EUR',
          fxRate: '35.000000',
          supplierOriginalAmount: '100.00',
        })
      );

      const supplierLine = entry.lines.find((l) => l.accountCode === '320');
      expect(supplierLine?.originalCredit).toBe('100.00');
      expect(supplierLine?.originalCurrency).toBe('EUR');
      expect(supplierLine?.fxRate).toBe('35.000000');

      // 108 fiilen giren TRY'dir; orijinal temeli YOK (çevrilmedi).
      const cashLine = entry.lines.find((l) => l.accountCode === '108');
      expect(cashLine?.originalCurrency).toBeUndefined();
    });

    it('temel yoksa hiçbir satır original* taşımaz', () => {
      const entry = rule.build(buildEvent());
      expect(entry.lines.every((l) => l.originalCurrency === undefined)).toBe(
        true
      );
    });
  });
});
