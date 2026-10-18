import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { PaymentRefundedRule } from './payment-refunded.rule';
import { PaymentRefundedEventPayload } from '../event-payloads';
import { UnmappedPaymentMethodException } from '../../exceptions/posting.exceptions';

const OCCURRED_AT = new Date('2026-10-13T10:00:00Z');
const PARTY_ID = '11111111-1111-4111-8111-111111111111';

const buildEvent = (
  payload: Partial<PaymentRefundedEventPayload> = {}
): FinancialEvent =>
  ({
    occurredAt: OCCURRED_AT,
    payload: {
      method: 'POS_CARD',
      amount: '250.00',
      partyId: PARTY_ID,
      ...payload,
    },
  }) as unknown as FinancialEvent;

describe('PaymentRefundedRule', () => {
  const rule = new PaymentRefundedRule();

  it('tahsilatın AYNASI: 120 borçlanır, hazır değer hesabı alacaklanır', () => {
    // Regresyon: iade hiçbir yoldan yevmiyeye ulaşmıyordu. Tahsilat 108/120
    // yazıyor, iade hiçbir şey yazmıyordu → 108'de hiç gelmeyecek para,
    // 120'de kapanmış görünen bir borç kalıyordu.
    const entry = rule.build(buildEvent());

    const byAccount = Object.fromEntries(
      entry.lines.map((l) => [l.accountCode, l])
    );

    expect(byAccount['120'].debit).toBe('250.00');
    expect(byAccount['120'].partyId).toBe(PARTY_ID);
    expect(byAccount['108'].credit).toBe('250.00');
  });

  it.each([
    ['CASH', '100'],
    ['BANK_TRANSFER', '102'],
    ['POS_CARD', '108'],
  ])(
    '%s iadesi geldiği enstrümandan çıkar → %s alacaklanır',
    (method, accountCode) => {
      // İade yönü `REFUND`: hesap enstrümandan gelir. `OUTBOUND` kümesi
      // bilinçli olarak kart taşımıyor (satıcıya kartla ödeme yapılmaz) ve onu
      // kullanmak her kart iadesini "eşlenmemiş yöntem" diye reddederdi.
      const entry = rule.build(buildEvent({ method: method as never }));

      const credited = entry.lines.find((l) => l.credit !== undefined);
      expect(credited?.accountCode).toBe(accountCode);
    }
  );

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

    expect(debit.equals(credit)).toBe(true);
    expect(debit.toFixed(2)).toBe('250.00');
  });

  it('eşlemesi olmayan yöntemde fiş ÜRETMEZ', () => {
    expect(() => rule.build(buildEvent({ method: 'CHECK' as never }))).toThrow(
      UnmappedPaymentMethodException
    );
  });

  it('fişin tarihi İADENİN tarihidir (tahsilatın değil)', () => {
    // Kritik ayrım: iade, tahsilat fişinin storno'su değil kendi tarihi olan
    // yeni bir olaydır. Storno olsaydı kapanmış döneme dokunmak gerekebilirdi.
    const entry = rule.build(buildEvent());

    expect(entry.date).toBe(OCCURRED_AT);
  });

  it('orijinal tahsilat izi fiş açıklamasına geçer', () => {
    const entry = rule.build(buildEvent({ reference: 'pos-tx-9' }));

    expect(entry.description).toContain('pos-tx-9');
  });

  it('yabancı para birimi fişe taşınır (çevrimi posting yapar — Model A)', () => {
    const entry = rule.build(buildEvent({ currency: 'EUR' }));

    expect(entry.currency).toBe('EUR');
  });
});
