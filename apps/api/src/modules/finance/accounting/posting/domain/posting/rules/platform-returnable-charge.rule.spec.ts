import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { PlatformReturnableChargeEventPayload } from '../event-payloads';
import { PlatformReturnableChargeReceivedRule } from './platform-returnable-charge-received.rule';
import { PlatformReturnableChargeRefundedRule } from './platform-returnable-charge-refunded.rule';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '../postable-event-types.constant';
import { FINANCIAL_EVENT_PAYLOAD_SCHEMAS } from '@modules/finance/shared/domain/contracts/financial-event-payload.schemas';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';

const OCCURRED_AT = new Date('2026-10-20T09:00:00Z');

const payload: PlatformReturnableChargeEventPayload = {
  amount: '250.00',
  currency: 'TRY',
  provider: 'IYZICO',
  chargeReference: 'ptx-2',
  reason: 'UNCLAIMED_CHARGE',
  bookingPaymentId: '33333333-3333-4333-8333-333333333333',
  refundId: '44444444-4444-4444-8444-444444444444',
};

const event = (): FinancialEvent =>
  ({ occurredAt: OCCURRED_AT, payload }) as unknown as FinancialEvent;

describe('Müşteriye iade edilecek tahsilat kuralları (336)', () => {
  describe('PlatformReturnableChargeReceivedRule', () => {
    const draft = new PlatformReturnableChargeReceivedRule().build(event());

    it('B 108 / A 336, aynı tutar, dengeli', () => {
      expect(draft.lines).toHaveLength(2);
      expect(draft.lines[0]).toMatchObject({ accountCode: '108', debit: '250.00' });
      expect(draft.lines[1]).toMatchObject({ accountCode: '336', credit: '250.00' });
    });

    it('olay tarihiyle yazılır ve TRY', () => {
      expect(draft.date).toEqual(OCCURRED_AT);
      expect(draft.currency).toBe('TRY');
    });

    it('336 gelir hesabı değildir (6xx/7xx satırı yok) ve cari istemez', () => {
      expect(draft.lines.some((l) => /^[67]/.test(l.accountCode))).toBe(false);
      expect(draft.lines.every((l) => l.partyId === undefined)).toBe(true);
    });
  });

  describe('PlatformReturnableChargeRefundedRule', () => {
    const draft = new PlatformReturnableChargeRefundedRule().build(event());

    it('B 336 / A 108: açan fişin tam aynası', () => {
      expect(draft.lines[0]).toMatchObject({ accountCode: '336', debit: '250.00' });
      expect(draft.lines[1]).toMatchObject({ accountCode: '108', credit: '250.00' });
    });
  });

  describe('kayıt kilitleri', () => {
    const types = [
      FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_RECEIVED,
      FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_REFUNDED,
    ];

    it.each(types)('%s fişlenebilir tip listesinde', (type) => {
      expect(POSTABLE_FINANCIAL_EVENT_TYPES).toContain(type);
    });

    it.each(types)('%s yazma anı şemasına sahip', (type) => {
      expect(FINANCIAL_EVENT_PAYLOAD_SCHEMAS[type]).toBeDefined();
    });

    it('dedupe anahtarı tahsilatın kimliğidir; iki yön ayrı anahtar', () => {
      const received = FinancialEventDedupeKeys.platform_returnable_charge_received(
        'IYZICO',
        'ptx-2'
      );
      const refunded = FinancialEventDedupeKeys.platform_returnable_charge_refunded(
        'IYZICO',
        'ptx-2'
      );
      expect(received).toBe('platform-returnable-charge-received:IYZICO:ptx-2');
      expect(refunded).not.toBe(received);
    });
  });
});
