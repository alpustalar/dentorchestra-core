import { FinancialEvent } from '@shared';
import { PaymentReceivedRule } from './payment-received.rule';
import { PaymentReceivedEventPayload } from '../event-payloads';
import { UnmappedPaymentMethodException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

const PARTY_ID = 'party-1';

const buildEvent = (
  payload: Partial<PaymentReceivedEventPayload> = {}
): FinancialEvent =>
  ({
    occurredAt: new Date('2026-08-08T12:00:00Z'),
    payload: {
      method: 'BANK_TRANSFER',
      amount: '1500.00',
      partyId: PARTY_ID,
      ...payload,
    },
  }) as unknown as FinancialEvent;

/**
 * Sistemdeki en sık işleyen kural (her tahsilat buradan geçer) ve testi yoktu.
 * Asıl koruma, yöntemin **doğru hazır değer hesabına** düşmesi: yanlış hesaba
 * düşen tahsilat dengeli bir fiş ürettiği için hiçbir bütünlük kontrolüne
 * yakalanmaz, yalnız banka/kasa mutabakatında eşleşmeyen bir hareket olarak
 * kalır.
 */
describe('PaymentReceivedRule', () => {
  const rule = new PaymentReceivedRule();

  it('alıcı carisini kapatır: 120 ALACAKLANIR, cari satıra taşınır', () => {
    const entry = rule.build(buildEvent());
    const receivable = entry.lines.find((l) => l.accountCode === '120');

    expect(receivable?.credit).toBe('1500.00');
    expect(receivable?.debit).toBeUndefined();
    expect(receivable?.partyId).toBe(PARTY_ID);
  });

  it('nakit → 100 Kasa borçlanır', () => {
    const entry = rule.build(buildEvent({ method: 'CASH' }));

    expect(entry.lines.find((l) => l.accountCode === '100')?.debit).toBe(
      '1500.00'
    );
    expect(entry.lines.find((l) => l.accountCode === '102')).toBeUndefined();
  });

  it('havale → 102 Bankalar borçlanır', () => {
    const entry = rule.build(buildEvent({ method: 'BANK_TRANSFER' }));

    expect(entry.lines.find((l) => l.accountCode === '102')?.debit).toBe(
      '1500.00'
    );
  });

  it('kart → 108 Diğer Hazır Değerler borçlanır (banka DEĞİL)', () => {
    const entry = rule.build(buildEvent({ method: 'POS_CARD' }));

    // 102'ye yazılsaydı hiçbir banka ekstresiyle eşleşmeyen bir hareket
    // oluşurdu: kart bedeli valörle birlikte sonradan bankaya geçer.
    expect(entry.lines.find((l) => l.accountCode === '108')?.debit).toBe(
      '1500.00'
    );
    expect(entry.lines.find((l) => l.accountCode === '102')).toBeUndefined();
  });

  it("eşlemesi olmayan yöntem sessizce 102'ye YAZILMAZ, hata verir", () => {
    const event = buildEvent({ method: 'CHECK' as never });

    expect(() => rule.build(event)).toThrow(UnmappedPaymentMethodException);
  });

  it('fiş denk', () => {
    const entry = rule.build(buildEvent());

    const debit = entry.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const credit = entry.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    expect(debit).toBe(credit);
  });

  it('yabancı para birimi taslağa taşınır (posting fonksiyonele çevirir)', () => {
    const entry = rule.build(buildEvent({ currency: 'EUR' }));

    expect(entry.currency).toBe('EUR');
  });
});
