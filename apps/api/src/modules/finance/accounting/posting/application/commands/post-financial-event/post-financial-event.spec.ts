import { Account, FinancialEvent } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IFxRateProvider } from '@src/infrastructure/payment/links/fx-rate.port';
import { IJournalCommandRepository } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { IJournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { PostingRuleRegistry } from '@modules/finance/accounting/posting/domain/posting/posting-rule.registry';
import {
  DraftJournalEntry,
  PostingRule,
} from '@modules/finance/accounting/posting/domain/posting/posting-rule.interface';
import { GetFinancialEventByIdQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-event-by-id/get-financial-event-by-id.query';
import { FindPeriodByDateQuery } from '@modules/finance/accounting/periods/application/queries/find-period-by-date/find-period-by-date.query';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import {
  ConflictingFxBasisException,
  PartyRequiredForAccountException,
  UnbalancedJournalEntryException,
} from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { PostFinancialEventHandler } from './post-financial-event.handler';
import { PostFinancialEventCommand } from './post-financial-event.command';

const CLINIC = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PARTY = '33333333-3333-4333-8333-333333333333';
const OCCURRED_AT = new Date('2026-08-08T10:00:00Z');

const account = (code: string, requiresParty = false): Account =>
  ({
    id: `acc-${code}`,
    code,
    isActive: true,
    isPostable: true,
    requiresParty,
  }) as unknown as Account;

const CHART: Account[] = [
  account('108'),
  account('320', true),
  account('601'),
  account('646'),
  account('656'),
];

const ctx = { actor: { clinicId: CLINIC } } as unknown as IGetContext;

/**
 * Posting handler'ın **yabancı para** yolunu kilitler.
 *
 * Bu handler defterin tek yazma kapısıdır (dönem kapısı, cari kuralı, çevrim,
 * denge, numara tahsisi) ama hiç birim testi yoktu: çevrim davranışı yalnız
 * `FxConversion`'ın saf testiyle kanıtlanıyordu — kuru kimin çözdüğü, hangi
 * kuru geçtiği, yuvarlama artığının nereye yazıldığı ve satır-seviyesi temelin
 * korunup korunmadığı testsizdi.
 */
describe('PostFinancialEventHandler — yabancı para', () => {
  const build = (
    draft: DraftJournalEntry,
    options: { functionalCurrency?: string; rate?: number } = {}
  ) => {
    const event = {
      id: 'evt-1',
      clinicId: CLINIC,
      organizationId: ORG,
      occurredAt: OCCURRED_AT,
      type: 'PLATFORM_BOOKING_SETTLED',
      performedById: null,
      payload: {},
    } as unknown as FinancialEvent;

    const created: JournalEntry[] = [];
    const journalCommandRepo = {
      findByEventId: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((entry: JournalEntry) => {
        created.push(entry);
        return Promise.resolve(entry);
      }),
    } as unknown as IJournalCommandRepository;

    const rule: PostingRule = {
      eventType: 'PLATFORM_BOOKING_SETTLED',
      build: () => draft,
    } as PostingRule;
    const registry = { get: () => rule } as unknown as PostingRuleRegistry;

    const getRate = jest.fn(() => Promise.resolve(options.rate ?? 35));
    const fx = { getRate } as unknown as IFxRateProvider;

    const entryNumbering = {
      lockAndAllocateEntryNo: jest.fn(() => Promise.resolve(1n)),
    } as unknown as IJournalEntryNumberingService;

    const queryBus = {
      execute: jest.fn((query: unknown) => {
        if (query instanceof GetFinancialEventByIdQuery) {
          return Promise.resolve({ data: event });
        }
        if (query instanceof FindPeriodByDateQuery) {
          return Promise.resolve({
            data: { id: 'period-1', year: 2026, status: 'OPEN' },
          });
        }
        if (query instanceof GetChartOfAccountsQuery) {
          return Promise.resolve({ data: CHART });
        }
        if (query instanceof GetClinicCurrencyQuery) {
          return Promise.resolve({
            data: options.functionalCurrency ?? 'TRY',
          });
        }
        throw new Error('beklenmeyen sorgu');
      }),
    } as unknown as TSQueryBus;

    const txManager = {
      outboxRun: <T>(fn: () => Promise<T>) => fn(),
    } as unknown as TransactionManager;

    return {
      handler: new PostFinancialEventHandler(
        journalCommandRepo,
        registry,
        fx,
        entryNumbering,
        queryBus,
        txManager
      ),
      created,
      getRate,
    };
  };

  const run = (
    draft: DraftJournalEntry,
    options?: { functionalCurrency?: string; rate?: number }
  ) => {
    const harness = build(draft, options);
    return harness.handler
      .execute(new PostFinancialEventCommand('evt-1', ctx))
      .then(() => harness);
  };

  it('fiş-seviyesi çevrim: kur İŞLEM TARİHİ ile çözülür, satırlar fonksiyonel paraya düşer', async () => {
    const { created, getRate } = await run({
      date: OCCURRED_AT,
      description: 'EUR tahsilat',
      currency: 'EUR',
      lines: [
        { accountCode: '108', debit: '120.00' },
        { accountCode: '601', credit: '20.00' },
        { accountCode: '320', partyId: PARTY, credit: '100.00' },
      ],
    });

    // Anlık kur değil, olayın tarihindeki kur (VUK/TCMB döviz alış).
    expect(getRate).toHaveBeenCalledWith('EUR', 'TRY', OCCURRED_AT);

    const lines = created[0].lines.items;
    const cash = lines.find((l) => l.accountId === 'acc-108');
    expect(cash?.debit.toString()).toBe('4200');
    expect(cash?.currency.value).toBe('TRY');
    expect(cash?.originalDebit?.toString()).toBe('120');
    expect(cash?.originalCurrency?.value).toBe('EUR');
    expect(cash?.fxRate?.toString()).toBe('35');
  });

  it('çevrim yuvarlama artığı Kambiyo hesabına yazılır (denge korunur)', async () => {
    // Kur 2.5; satırlar ayrı ayrı yuvarlanınca borç/alacak bir kuruş kayar.
    const { created } = await run(
      {
        date: OCCURRED_AT,
        description: 'artık',
        currency: 'EUR',
        lines: [
          { accountCode: '108', debit: '2.02' },
          { accountCode: '601', credit: '1.01' },
          { accountCode: '320', partyId: PARTY, credit: '1.01' },
        ],
      },
      { rate: 2.5 }
    );

    const lines = created[0].lines.items;
    // 2.02 × 2.5 = 5.05 borç; 1.01 × 2.5 = 2.53 (×2) = 5.06 alacak → 0.01 fark
    // borç tarafına eklenir: 656 Kambiyo Zararı.
    const kambiyo = lines.find((l) => l.accountId === 'acc-656');
    expect(kambiyo?.debit.toString()).toBe('0.01');
    expect(created[0].totalDebit.toString()).toBe(
      created[0].totalCredit.toString()
    );
  });

  it('artık tavanı: kaynak olayın kendisi dengesizse Kambiyo’ya yazılmaz', async () => {
    // Fark satır sayısı × 1 kuruşu aşıyor → "kur farkı" diye defterlenmez.
    await expect(
      run(
        {
          date: OCCURRED_AT,
          description: 'dengesiz',
          currency: 'EUR',
          lines: [
            { accountCode: '108', debit: '120.00' },
            { accountCode: '601', credit: '10.00' },
            { accountCode: '320', partyId: PARTY, credit: '100.00' },
          ],
        },
        { rate: 2 }
      )
    ).rejects.toThrow(UnbalancedJournalEntryException);
  });

  it('satır-seviyesi temel: gövde fonksiyonel parada olsa bile original* korunur', async () => {
    const { created, getRate } = await run({
      date: OCCURRED_AT,
      description: 'TRY tahsilat, EUR borç',
      currency: 'TRY',
      lines: [
        { accountCode: '108', debit: '4200.00' },
        { accountCode: '601', credit: '700.00' },
        {
          accountCode: '320',
          partyId: PARTY,
          credit: '3500.00',
          originalCredit: '100.00',
          originalCurrency: 'EUR',
          fxRate: '35.000000',
        },
      ],
    });

    // Gövde zaten fonksiyonel parada → posting kur ÇÖZMEZ (ikinci kur kaynağı yok).
    expect(getRate).not.toHaveBeenCalled();

    const lines = created[0].lines.items;
    const supplier = lines.find((l) => l.accountId === 'acc-320');
    expect(supplier?.credit.toString()).toBe('3500');
    expect(supplier?.originalCredit?.toString()).toBe('100');
    expect(supplier?.originalCurrency?.value).toBe('EUR');
    expect(supplier?.fxRate?.toString()).toBe('35');

    // Kasa satırı çevrilmedi → orijinali yok.
    const cash = lines.find((l) => l.accountId === 'acc-108');
    expect(cash?.originalCurrency).toBeNull();
  });

  it('çifte temel (fiş çevrimi + satır temeli) adıyla reddedilir', async () => {
    await expect(
      run({
        date: OCCURRED_AT,
        description: 'çifte temel',
        currency: 'EUR',
        lines: [
          { accountCode: '108', debit: '120.00' },
          { accountCode: '601', credit: '20.00' },
          {
            accountCode: '320',
            partyId: PARTY,
            credit: '100.00',
            originalCredit: '100.00',
            originalCurrency: 'USD',
            fxRate: '40.000000',
          },
        ],
      })
    ).rejects.toThrow(ConflictingFxBasisException);
  });

  it('cari zorunlu hesapta party yoksa fiş HİÇ yazılmaz', async () => {
    // Kuralın birim testi bunu kanıtlayamaz: koşul satır döngüsünde zorlanıyor.
    await expect(
      run({
        date: OCCURRED_AT,
        description: 'carisiz 320',
        currency: 'TRY',
        lines: [
          { accountCode: '108', debit: '100.00' },
          { accountCode: '320', credit: '100.00' },
        ],
      })
    ).rejects.toThrow(PartyRequiredForAccountException);
  });
});
