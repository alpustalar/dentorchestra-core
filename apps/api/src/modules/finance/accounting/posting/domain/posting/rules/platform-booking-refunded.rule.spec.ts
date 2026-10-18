import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { PlatformBookingRefundedRule } from './platform-booking-refunded.rule';
import { PlatformBookingRefundedEventPayload } from '../event-payloads';
import { PlatformBookingRefundAmountsMismatchException } from '../../exceptions/posting.exceptions';

const OCCURRED_AT = new Date('2026-10-13T10:00:00Z');
const SUPPLIER_PARTY = '55555555-5555-4555-8555-555555555555';

/** Tahsilat: sale 1200 = komisyon 200 + tedarikçi 1000. İade: tam tutar. */
const buildEvent = (
  payload: Partial<PlatformBookingRefundedEventPayload> = {}
): FinancialEvent =>
  ({
    occurredAt: OCCURRED_AT,
    payload: {
      refundAmount: '1200.00',
      commission: '200.00',
      supplierReleased: '1000.00',
      retainedLoss: '0.00',
      supplierPartyId: SUPPLIER_PARTY,
      currency: 'EUR',
      bookingType: 'HOTEL',
      provider: 'STRIPE',
      ...payload,
    },
  }) as unknown as FinancialEvent;

const byAccount = (lines: { accountCode: string }[]) =>
  Object.fromEntries(lines.map((l) => [l.accountCode, l])) as Record<
    string,
    { debit?: string; credit?: string; partyId?: string | null }
  >;

describe('PlatformBookingRefundedRule', () => {
  const rule = new PlatformBookingRefundedRule();

  it('cezasız iptal: komisyon 610’a, tedarikçi borcu 320’ye, para 108’den çıkar', () => {
    const lines = byAccount(rule.build(buildEvent()).lines);

    // 601'in borcuna yazmak yerine 610: iade sonraki döneme düşerse o dönemin
    // brüt hasılatını eksiye çekmez, "satıştan iadeler" olarak görünür.
    expect(lines['610'].debit).toBe('200.00');
    expect(lines['320'].debit).toBe('1000.00');
    expect(lines['320'].partyId).toBe(SUPPLIER_PARTY);
    expect(lines['108'].credit).toBe('1200.00');
    // Cezasız iptalde zarar satırı hiç oluşmaz (sıfır tutarlı satır geçersiz).
    expect(lines['689']).toBeUndefined();
  });

  it('cezalı iptal: ceza 689’da zarar, 320 yalnız serbest kalan kadar düşer', () => {
    const lines = byAccount(
      rule.build(
        buildEvent({ supplierReleased: '700.00', retainedLoss: '300.00' })
      ).lines
    );

    expect(lines['320'].debit).toBe('700.00');
    expect(lines['689'].debit).toBe('300.00');
    expect(lines['108'].credit).toBe('1200.00');
  });

  it('tamamı cezalı iptal: 320 satırı hiç yazılmaz', () => {
    const lines = byAccount(
      rule.build(
        buildEvent({ supplierReleased: '0.00', retainedLoss: '1000.00' })
      ).lines
    );

    expect(lines['320']).toBeUndefined();
    expect(lines['689'].debit).toBe('1000.00');
  });

  it('fiş denk: borç toplamı = alacak toplamı', () => {
    const entry = rule.build(
      buildEvent({ supplierReleased: '700.00', retainedLoss: '300.00' })
    );

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
    // Ceza 320'den düşülmemiş: 200 + 1000 + 300 ≠ 1200.
    expect(() => rule.build(buildEvent({ retainedLoss: '300.00' }))).toThrow(
      PlatformBookingRefundAmountsMismatchException
    );
  });

  it('satış para birimini taşır — çevrimi posting yapar (Model A)', () => {
    expect(rule.build(buildEvent({ currency: 'USD' })).currency).toBe('USD');
  });

  it('olayın tarihi fişin tarihidir — iade kendi tarihinde yaşar', () => {
    // Tahsilat fişinin tarihi DEĞİL: storno değil, yeni bir ekonomik olay.
    expect(rule.build(buildEvent()).date).toBe(OCCURRED_AT);
  });

  it('rezervasyon türü fiş açıklamasına geçer', () => {
    expect(
      rule.build(buildEvent({ bookingType: 'FLIGHT' })).description
    ).toContain('FLIGHT');
  });

  it('komisyonsuz satışın iadesinde 610 satırı sıfır tutarla da yazılır (601’in aynası)', () => {
    // Tahsilat kuralı komisyonsuz satışta 601'i 0.00 yazıyor; 610'u atlamak iki
    // fişin satır yapısını ayırır ve karşılaştırmayı bozardı. 320/689 ise
    // koşullu: sıfırla yazılsalardı olmayan bir hareketi/zararı beyan ederlerdi.
    const lines = byAccount(
      rule.build(
        buildEvent({
          refundAmount: '1000.00',
          commission: '0.00',
          supplierReleased: '1000.00',
        })
      ).lines
    );

    expect(lines['610'].debit).toBe('0.00');
  });

  describe('satır-seviyesi yabancı para temeli', () => {
    it('320 ve 689 orijinal tutarı + kilitli kuru taşır; 108 taşımaz', () => {
      const entry = rule.build(
        buildEvent({
          currency: 'TRY',
          refundAmount: '4200.00',
          commission: '700.00',
          supplierReleased: '2800.00',
          retainedLoss: '700.00',
          originalCurrency: 'EUR',
          fxRate: '35.000000',
          supplierReleasedOriginalAmount: '80.00',
          retainedLossOriginalAmount: '20.00',
        })
      );

      const byAccount = Object.fromEntries(
        entry.lines.map((l) => [l.accountCode, l])
      );

      expect(byAccount['320'].originalDebit).toBe('80.00');
      expect(byAccount['320'].originalCurrency).toBe('EUR');
      expect(byAccount['689'].originalDebit).toBe('20.00');
      expect(byAccount['689'].fxRate).toBe('35.000000');
      // Giden para TRY'dir; 610 de TRY cinsinden artıktır.
      expect(byAccount['108'].originalCurrency).toBeUndefined();
      expect(byAccount['610'].originalCurrency).toBeUndefined();
    });
  });
});
