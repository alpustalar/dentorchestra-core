import { Decimal } from 'decimal.js';
import { JournalEntry } from './journal-entry.entity';
import { JournalEntryReversedEvent } from '@modules/finance/accounting/posting/domain/events';
import {
  JournalEntryAlreadyReversedException,
  JournalEntryInsufficientLinesException,
  JournalEntryNotPostedException,
} from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { UnbalancedJournalEntryException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';

describe('JournalEntry (yevmiye fişi aggregate)', () => {
  const ORIG_ID = '33333333-3333-4333-8333-333333333333';
  const REVERSAL_ID = '44444444-4444-4444-8444-444444444444';

  const buildDraft = (
    lines: Parameters<typeof JournalEntry.createDraft>[0]['lines']
  ) =>
    JournalEntry.createDraft({
      id: ORIG_ID,
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      periodId: 'period-2026',
      entryDate: new Date('2026-03-15'),
      description: 'Tahsilat',
      lines,
    });

  /** TRY defterde basit tahsilat fişi (B 100 / A 600). */
  const buildPosted = () => {
    const entry = buildDraft([
      { accountId: 'acc-100', debit: '1000', currency: 'TRY' },
      { accountId: 'acc-600', credit: '1000', currency: 'TRY' },
    ]);
    entry.post(100n); // sıra no VO en az 3 karakter ister
    return entry;
  };

  describe('yapısal invariant', () => {
    it('dengesiz fiş tipli hata fırlatır ve tutarları taşır', () => {
      // Modülün en kritik invariant'ı: gövdesiz 400 değil, farkı gösteren hata.
      let thrown: unknown;
      try {
        buildDraft([
          { accountId: 'acc-100', debit: '1000' },
          { accountId: 'acc-600', credit: '900' },
        ]);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(UnbalancedJournalEntryException);
      expect((thrown as UnbalancedJournalEntryException).meta).toEqual({
        totalDebit: '1000',
        totalCredit: '900',
      });
    });

    it('tek satırlı fiş reddedilir', () => {
      expect(() =>
        buildDraft([{ accountId: 'acc-100', debit: '1000' }])
      ).toThrow(JournalEntryInsufficientLinesException);
    });
  });

  describe('fiş niteliği (kind)', () => {
    it('varsayılan OPERATIONAL — posting kuralları ekonomik fiş üretir', () => {
      expect(buildPosted().kind).toBe('OPERATIONAL');
      expect(buildPosted().toPersistence().kind).toBe('OPERATIONAL');
    });

    it('CLOSING açıkça geçilir ve persistence alanına taşınır', () => {
      const entry = JournalEntry.createDraft({
        id: ORIG_ID,
        clinicId: 'clinic-1',
        organizationId: 'org-1',
        periodId: 'period-2026',
        entryDate: new Date('2026-12-31'),
        kind: 'CLOSING',
        lines: [
          { accountId: 'acc-600', debit: '1000', currency: 'TRY' },
          { accountId: 'acc-690', credit: '1000', currency: 'TRY' },
        ],
      });

      // Mapping'in alanı düşürmesi sessiz veri kaybı olurdu: işaretsiz kalan
      // kapanış fişi gelir tablosuna karışır ve kapanmış yılın cirosunu sıfırlar.
      expect(entry.toPersistence().kind).toBe('CLOSING');
    });

    it('storno niteliği DEVRALIR — kapanış fişinin stornosu da CLOSING olur', () => {
      const closing = JournalEntry.createDraft({
        id: ORIG_ID,
        clinicId: 'clinic-1',
        organizationId: 'org-1',
        periodId: 'period-2026',
        entryDate: new Date('2026-12-31'),
        kind: 'CLOSING',
        lines: [
          { accountId: 'acc-600', debit: '1000', currency: 'TRY' },
          { accountId: 'acc-690', credit: '1000', currency: 'TRY' },
        ],
      });
      closing.post(100n);

      const reversal = closing.buildReversalDraft({
        reversalId: REVERSAL_ID,
        periodId: 'period-2027',
        entryDate: new Date('2027-01-05'),
      });

      // OPERATIONAL kalsaydı storno gelir tablosuna TERS işaretle girer ve
      // kapanmış yılın cirosunu kapanış tutarı kadar şişirirdi.
      expect(reversal.kind).toBe('CLOSING');
    });

    it('ekonomik fişin stornosu OPERATIONAL kalır', () => {
      const reversal = buildPosted().buildReversalDraft({
        reversalId: REVERSAL_ID,
        periodId: 'period-2026',
        entryDate: new Date('2026-04-01'),
      });

      expect(reversal.kind).toBe('OPERATIONAL');
    });
  });

  describe('toPersistence saflığı', () => {
    it('iki çağrı aynı updatedAt değerini döndürür', () => {
      const entry = buildPosted();
      expect(entry.toPersistence().updatedAt).toEqual(
        entry.toPersistence().updatedAt
      );
      // Damga entity'nin kendi alanından gelir; mühürleme anını taşır.
      expect(entry.toPersistence().updatedAt).toEqual(entry.updatedAt);
    });
  });

  describe('buildReversalDraft', () => {
    it('borç/alacağı tersler ve satırın para birimini taşır', () => {
      const original = buildPosted();
      const reversal = original.buildReversalDraft({
        reversalId: REVERSAL_ID,
        periodId: 'period-2027',
        entryDate: new Date('2027-01-10'),
      });

      const [first, second] = reversal.lines.items;
      expect(first.credit.toString()).toBe('1000');
      expect(first.debit.toString()).toBe('0');
      expect(second.debit.toString()).toBe('1000');
      // Para birimi geçilmezse JournalLine TRY'ye düşerdi: fonksiyonel parası
      // TRY olmayan bir defterde storno satırı başka bir para biriminde
      // damgalanır ve mizan iki para birimini aynı kolonda toplardı.
      expect(first.currency.value).toBe('TRY');
      expect(second.currency.value).toBe('TRY');
      expect(reversal.isBalanced).toBe(true);
      expect(reversal.eventId).toBeNull();
    });

    it('yabancı para defterinde para birimi ve kur izi korunur', () => {
      const entry = JournalEntry.createDraft({
        id: ORIG_ID,
        clinicId: 'clinic-1',
        organizationId: 'org-1',
        periodId: 'period-2026',
        entryDate: new Date('2026-03-15'),
        lines: [
          {
            accountId: 'acc-100',
            debit: '3500',
            currency: 'EUR',
            originalDebit: '100',
            originalCurrency: 'USD',
            fxRate: '35',
          },
          {
            accountId: 'acc-600',
            credit: '3500',
            currency: 'EUR',
            originalCredit: '100',
            originalCurrency: 'USD',
            fxRate: '35',
          },
        ],
      });
      entry.post(101n);

      const reversal = entry.buildReversalDraft({
        reversalId: REVERSAL_ID,
        periodId: 'period-2026',
        entryDate: new Date('2026-04-01'),
      });

      const [first] = reversal.lines.items;
      expect(first.currency.value).toBe('EUR');
      // Orijinal tutar da terslenir; kur snapshot'ı aynı kalır — storno bugünün
      // kuruyla kapatılırsa defterde gerçek olmayan bir kur farkı doğar.
      expect(first.originalCredit?.toString()).toBe('100');
      // Orijinal satır borçluydu → ters kayıtta borç tarafının orijinali yoktur.
      expect(first.originalDebit).toBeNull();
      expect(first.originalCurrency?.value).toBe('USD');
      expect(first.fxRate).toEqual(new Decimal('35'));
    });

    it('POSTED olmayan fiş storno edilemez', () => {
      const draft = buildDraft([
        { accountId: 'acc-100', debit: '1000' },
        { accountId: 'acc-600', credit: '1000' },
      ]);

      expect(() =>
        draft.buildReversalDraft({
          reversalId: REVERSAL_ID,
          periodId: 'period-2026',
          entryDate: new Date('2026-04-01'),
        })
      ).toThrow(JournalEntryNotPostedException);
    });
  });

  describe('markReversed', () => {
    it('durumu REVERSED yapar ve denetim olayı fırlatır', () => {
      const entry = buildPosted();
      entry.clearDomainEvents();

      entry.markReversed({
        reversalId: REVERSAL_ID,
        actorId: 'user-9',
        reason: 'Yanlış hesap',
        source: LogSource.WEB,
      });

      expect(entry.isReversed()).toBe(true);
      expect(entry.reversedById).toBe(REVERSAL_ID);

      const events = entry.getDomainEvents();
      expect(events).toHaveLength(1);
      const event = events[0] as JournalEntryReversedEvent;
      expect(event).toBeInstanceOf(JournalEntryReversedEvent);
      // "Kim, neyi, hangi ters kayıtla, neden" — denetimde aranabilir olmalı.
      expect(event.entryId).toBe(ORIG_ID);
      expect(event.reversalId).toBe(REVERSAL_ID);
      expect(event.entryNo).toBe('100');
      expect(event.reason).toBe('Yanlış hesap');
      expect(event.log?.actorId).toBe('user-9');
      expect(event.log?.action).toBe(LogAction.JOURNAL_ENTRY_REVERSED);
      expect(event.log?.type).toBe(LogType.SECURITY);
    });

    it('aynı fiş ikinci kez storno edilemez', () => {
      const entry = buildPosted();
      entry.markReversed({ reversalId: REVERSAL_ID, actorId: 'user-9' });

      expect(() =>
        entry.markReversed({ reversalId: 'other', actorId: 'user-9' })
      ).toThrow(JournalEntryAlreadyReversedException);
    });
  });
});
