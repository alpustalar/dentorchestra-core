import { Decimal } from 'decimal.js';
import { FinancialEvent } from '@shared';
import { DraftJournalEntry } from '../posting-rule.interface';
import { CardChargebackOpenedRule } from './card-chargeback-opened.rule';
import { CardChargebackWonRule } from './card-chargeback-won.rule';
import { CardChargebackLostRule } from './card-chargeback-lost.rule';
import {
  CardChargebackLostEventPayload,
  CardChargebackOpenedEventPayload,
  CardChargebackWonEventPayload,
} from '../event-payloads';
import { UnmappedChargebackChannelException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import {
  CHARGEBACK_FUNDS_ACCOUNT,
  CHARGEBACK_FUNDS_CHANNELS,
} from '@modules/finance/shared/domain/constants/chargeback-funds.constant';
import { FINANCIAL_EVENT_PAYLOAD_SCHEMAS } from '@modules/finance/shared/domain/contracts/financial-event-payload.schemas';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '../postable-event-types.constant';
import { FinancialEventTypeSchema } from '@shared';

const OCCURRED_AT = new Date('2026-10-19T00:00:00Z');
const PARTY_ID = '7f3a6c52-8b4e-4f0a-9d52-1c3d6e8f9a01';

const buildEvent = <T extends object>(payload: T): FinancialEvent =>
  ({ occurredAt: OCCURRED_AT, payload }) as unknown as FinancialEvent;

const opened = (
  payload: Partial<CardChargebackOpenedEventPayload> = {}
): FinancialEvent =>
  buildEvent<CardChargebackOpenedEventPayload>({
    amount: '1000.00',
    feeAmount: '25.00',
    fundsChannel: 'FUNDS_IN_TRANSIT',
    currency: 'TRY',
    provider: 'IYZICO',
    caseReference: 'CB-1001',
    ...payload,
  });

const won = (payload: Partial<CardChargebackWonEventPayload> = {}) =>
  buildEvent<CardChargebackWonEventPayload>({
    amount: '1000.00',
    fundsChannel: 'FUNDS_IN_TRANSIT',
    currency: 'TRY',
    provider: 'IYZICO',
    caseReference: 'CB-1001',
    ...payload,
  });

const lost = (payload: Partial<CardChargebackLostEventPayload> = {}) =>
  buildEvent<CardChargebackLostEventPayload>({
    amount: '1000.00',
    partyId: PARTY_ID,
    currency: 'TRY',
    provider: 'IYZICO',
    caseReference: 'CB-1001',
    ...payload,
  });

const total = (entry: DraftJournalEntry, side: 'debit' | 'credit'): Decimal =>
  entry.lines.reduce(
    (acc, line) => acc.plus(new Decimal(line[side] ?? 0)),
    new Decimal(0)
  );

const linesOf = (entry: DraftJournalEntry, code: string) =>
  entry.lines.filter((l) => l.accountCode === code);

/**
 * Bu üç kural olmadığı sürece kart itirazı deftere hiç ulaşmıyordu: sağlayıcı
 * parayı geri kesiyor, 108'de olmayan para ve 120'de kapanmış görünen borç
 * kalıyordu. Üçü de dengeli bir mizan üretir — yani hiçbir denge kontrolüne
 * yakalanmaz; hesapları testle kilitlemek tek güvence.
 */
describe('Kart itirazı posting kuralları', () => {
  describe('CardChargebackOpenedRule — B 127 (+ B 653) / A 108|102', () => {
    const rule = new CardChargebackOpenedRule();

    it('127 tutar borçlanır, 108 tutar+ücret alacaklanır, 653 ücret borçlanır', () => {
      const entry = rule.build(opened());

      expect(linesOf(entry, '127')).toEqual([
        expect.objectContaining({ debit: '1000.00' }),
      ]);
      expect(linesOf(entry, '653')).toEqual([
        expect.objectContaining({ debit: '25.00' }),
      ]);
      // İki alacak satırı bilinçli ayrı: her biri kendi ekstre hareketiyle
      // eşleşebilsin.
      expect(linesOf(entry, '108').map((l) => l.credit)).toEqual([
        '1000.00',
        '25.00',
      ]);
    });

    it('fiş dengelidir (Σborç = Σalacak)', () => {
      const entry = rule.build(opened());

      expect(total(entry, 'debit').toFixed(2)).toBe('1025.00');
      expect(total(entry, 'debit').equals(total(entry, 'credit'))).toBe(true);
    });

    it('ücret sıfırsa 653 satırı ve ikinci alacak satırı YAZILMAZ', () => {
      // Sıfır tutarlı satır geçersizdir (§81.4) ve "en az iki satır" kuralını
      // sahte biçimde sağlardı.
      const entry = rule.build(opened({ feeAmount: '0.00' }));

      expect(entry.lines).toHaveLength(2);
      expect(linesOf(entry, '653')).toHaveLength(0);
      expect(total(entry, 'debit').equals(total(entry, 'credit'))).toBe(true);
    });

    it('BANK kanalında alacak 102 Bankalar’a yazılır (108’e değil)', () => {
      const entry = rule.build(opened({ fundsChannel: 'BANK' }));

      expect(linesOf(entry, '102').map((l) => l.credit)).toEqual([
        '1000.00',
        '25.00',
      ]);
      expect(linesOf(entry, '108')).toHaveLength(0);
    });

    it('fişin tarihi paranın kesildiği gündür; vaka numarası satır açıklamasındadır', () => {
      const entry = rule.build(opened({ caseReference: 'CB-XYZ' }));

      expect(entry.date).toBe(OCCURRED_AT);
      expect(linesOf(entry, '127')[0].desc).toContain('CB-XYZ');
    });

    it('para birimi gövdeden taşınır (Model A — posting çevirir)', () => {
      expect(rule.build(opened({ currency: 'EUR' })).currency).toBe('EUR');
    });

    it('eşlemesi olmayan kanal sessizce bir hesaba yazılmaz — sesli patlar', () => {
      expect(() =>
        rule.build(
          opened({
            fundsChannel: 'CHEQUE' as unknown as 'BANK',
          })
        )
      ).toThrow(UnmappedChargebackChannelException);
    });
  });

  describe('CardChargebackWonRule — B 108|102 / A 127', () => {
    const rule = new CardChargebackWonRule();

    it('para döndüğü kanala borçlanır, 127 kapanır', () => {
      const entry = rule.build(won());

      expect(linesOf(entry, '108')).toEqual([
        expect.objectContaining({ debit: '1000.00' }),
      ]);
      expect(linesOf(entry, '127')).toEqual([
        expect.objectContaining({ credit: '1000.00' }),
      ]);
      expect(total(entry, 'debit').equals(total(entry, 'credit'))).toBe(true);
    });

    it('açılıştaki kanala bağlı DEĞİL: banka kanalı seçilirse 102’ye döner', () => {
      // Sağlayıcı kazanılan parayı bir sonraki payout'a da koyabilir, doğrudan
      // bankaya da yatırabilir; kanal çözüm anında operatörden alınır.
      const entry = rule.build(won({ fundsChannel: 'BANK' }));

      expect(linesOf(entry, '102')).toEqual([
        expect.objectContaining({ debit: '1000.00' }),
      ]);
      expect(linesOf(entry, '108')).toHaveLength(0);
    });

    it('itiraz ücreti geri verilmez: fişte 653 satırı yoktur', () => {
      expect(linesOf(rule.build(won()), '653')).toHaveLength(0);
    });

    it('eşlemesi olmayan kanalda sesli patlar', () => {
      expect(() =>
        rule.build(won({ fundsChannel: 'CASH' as unknown as 'BANK' }))
      ).toThrow(UnmappedChargebackChannelException);
    });
  });

  describe('CardChargebackLostRule — B 120 (hasta) / A 127', () => {
    const rule = new CardChargebackLostRule();

    it('hasta carisi borçlanır (borç yeniden doğar), 127 kapanır', () => {
      const entry = rule.build(lost());

      expect(linesOf(entry, '120')).toEqual([
        expect.objectContaining({ debit: '1000.00', partyId: PARTY_ID }),
      ]);
      expect(linesOf(entry, '127')).toEqual([
        expect.objectContaining({ credit: '1000.00' }),
      ]);
      expect(total(entry, 'debit').equals(total(entry, 'credit'))).toBe(true);
    });

    it('120 satırı cari taşır — 120 requiresParty olduğu için carisiz fiş postlanamaz', () => {
      const entry = rule.build(lost());

      expect(linesOf(entry, '120')[0].partyId).toBeTruthy();
    });

    it('108/102’ye dokunmaz: para zaten açılışta çıkmıştı', () => {
      const entry = rule.build(lost());

      expect(linesOf(entry, '108')).toHaveLength(0);
      expect(linesOf(entry, '102')).toHaveLength(0);
    });
  });

  describe('kapsam kilitleri (kural 12 — kapı kullanımdan geniş olamaz)', () => {
    it('her kanalın bir defter hesabı vardır ve kümeler birebir örtüşür', () => {
      expect([...CHARGEBACK_FUNDS_CHANNELS].sort()).toEqual(
        Object.keys(CHARGEBACK_FUNDS_ACCOUNT).sort()
      );
      for (const channel of CHARGEBACK_FUNDS_CHANNELS) {
        expect(CHARGEBACK_FUNDS_ACCOUNT[channel]).toMatch(/^10[28]$/);
      }
    });

    it('üç olay tipi de postlanabilir listede ve gövde şemasına sahiptir', () => {
      const {
        CARD_CHARGEBACK_OPENED,
        CARD_CHARGEBACK_WON,
        CARD_CHARGEBACK_LOST,
      } = FinancialEventTypeSchema.enum;

      for (const type of [
        CARD_CHARGEBACK_OPENED,
        CARD_CHARGEBACK_WON,
        CARD_CHARGEBACK_LOST,
      ]) {
        expect(POSTABLE_FINANCIAL_EVENT_TYPES).toContain(type);
        expect(FINANCIAL_EVENT_PAYLOAD_SCHEMAS[type]).toBeDefined();
      }
    });

    it('gövde şeması ücretsiz açılışı kabul eder; ücret kuruştan inceyse reddeder', () => {
      const schema =
        FINANCIAL_EVENT_PAYLOAD_SCHEMAS[
          FinancialEventTypeSchema.enum.CARD_CHARGEBACK_OPENED
        ]!;
      const base = {
        amount: '1000.00',
        feeAmount: '0.00',
        fundsChannel: 'BANK',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'CB-1',
      };

      expect(schema.safeParse(base).success).toBe(true);
      expect(schema.safeParse({ ...base, feeAmount: '0.005' }).success).toBe(
        false
      );
      expect(schema.safeParse({ ...base, amount: '0.00' }).success).toBe(false);
      expect(
        schema.safeParse({ ...base, fundsChannel: 'CHEQUE' }).success
      ).toBe(false);
    });

    it('kaybedilen itiraz gövdesi carisiz yazılamaz (postlanamayan ölümsüz olay)', () => {
      const schema =
        FINANCIAL_EVENT_PAYLOAD_SCHEMAS[
          FinancialEventTypeSchema.enum.CARD_CHARGEBACK_LOST
        ]!;
      const base = {
        amount: '1000.00',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'CB-1',
      };

      expect(schema.safeParse({ ...base, partyId: PARTY_ID }).success).toBe(
        true
      );
      expect(schema.safeParse(base).success).toBe(false);
    });
  });
});
