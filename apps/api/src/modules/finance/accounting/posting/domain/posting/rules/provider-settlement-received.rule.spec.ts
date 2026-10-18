import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { ProviderSettlementReceivedRule } from './provider-settlement-received.rule';
import { ProviderSettlementReceivedEventPayload } from '../event-payloads';

const OCCURRED_AT = new Date('2026-10-15T00:00:00Z');

const buildEvent = (
  payload: Partial<ProviderSettlementReceivedEventPayload> = {}
): FinancialEvent =>
  ({
    occurredAt: OCCURRED_AT,
    payload: {
      grossAmount: '10000.00',
      netAmount: '9815.00',
      commissionAmount: '185.00',
      currency: 'TRY',
      provider: 'IYZICO',
      reference: 'PAYOUT-1',
      ...payload,
    },
  }) as unknown as FinancialEvent;

/**
 * Bu kural olmadığı sürece 108 **hiç kapanmıyordu**: her kart tahsilatı orada
 * birikiyor (bilanço şişik), para 102'ye hiç girmiyor (banka ekstresiyle
 * mutabakat imkânsız) ve sağlayıcı komisyonu hiç gider yazılmıyordu (kâr fazla).
 * Üçü de dengeli bir mizan üretiyor, yani hiçbir denge kontrolüne yakalanmıyor.
 */
describe('ProviderSettlementReceivedRule', () => {
  const rule = new ProviderSettlementReceivedRule();

  const byAccount = (lines: { accountCode: string }[]) =>
    Object.fromEntries(lines.map((l) => [l.accountCode, l]));

  it('102 net borçlanır, 653 komisyon borçlanır, 108 brüt alacaklanır', () => {
    const entry = rule.build(buildEvent());
    const lines = byAccount(entry.lines) as Record<
      string,
      { debit?: string; credit?: string }
    >;

    expect(lines['102'].debit).toBe('9815.00');
    expect(lines['653'].debit).toBe('185.00');
    expect(lines['108'].credit).toBe('10000.00');
  });

  it('fiş dengelidir (Σborç = Σalacak)', () => {
    const entry = rule.build(buildEvent());

    const total = (side: 'debit' | 'credit') =>
      entry.lines.reduce(
        (acc, line) => acc.plus(new Decimal(line[side] ?? 0)),
        new Decimal(0)
      );

    expect(total('debit').toFixed(2)).toBe(total('credit').toFixed(2));
  });

  it('komisyon sıfırsa 653 satırı YAZILMAZ', () => {
    // Sıfır tutarlı satır geçersizdir (§81.4) ve "en az iki satır" kuralını
    // sahte biçimde sağlardı.
    const entry = rule.build(
      buildEvent({ commissionAmount: '0.00', netAmount: '10000.00' })
    );

    expect(entry.lines).toHaveLength(2);
    expect(byAccount(entry.lines)['653']).toBeUndefined();
  });

  it('fişin tarihi payout günüdür ve referans satır açıklamasında durur', () => {
    const entry = rule.build(buildEvent({ reference: 'PAYOUT-XYZ' }));

    expect(entry.date).toBe(OCCURRED_AT);
    const line108 = byAccount(entry.lines)['108'] as { desc?: string };
    expect(line108.desc).toContain('PAYOUT-XYZ');
  });

  it('para birimi gövdeden taşınır (Model A — posting çevirir)', () => {
    const entry = rule.build(buildEvent({ currency: 'EUR' }));

    expect(entry.currency).toBe('EUR');
  });
});
