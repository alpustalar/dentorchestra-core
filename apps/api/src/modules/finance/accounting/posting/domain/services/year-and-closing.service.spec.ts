import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { Account } from '@shared';
import { YearEndClosingService } from './year-and-closing.service';
import { AccountResolver } from '@modules/finance/accounting/posting/domain/posting/account-resolver';
import { TrialBalanceRow } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import {
  ClosingAccrual,
  planYearEndClosing,
} from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import { AccountCodeNotFoundException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { ClosingNextPeriodRequiredException } from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';

/**
 * Yıl sonu kapanışı defterdeki en yüksek etkili **yazma**: kapanan dönemin bütün gelir/gider
 * hesaplarını sıfırlar ve kârı öz kaynağa taşır. Hesaplama planlayıcıdadır
 * (`year-end-closing.planner.spec.ts`); bu suite planın FİŞE dönüşümünü kilitler.
 *
 * Kilitlenen dört şey:
 * 1. Kapanış fişleri `CLOSING` işaretlenir — işaretsiz kalırsa gelir tablosu onları da sayar ve
 *    kapanmış yılın cirosu **sıfır** görünür (hata sessiz: fiş kendi içinde dengeli).
 *    Tahakkuk fişleri ise `ADJUSTING`'tir: ekonomiktir, gelir tablosu SAYAR.
 * 2. Yalnız sonuç hesapları (6/7) kapatılır; bilanço hesabı (1–5) kapatılmaz.
 * 3. 690 havuzu ve 590/591 devri dengeli ve doğru yönlüdür (kâr ↔ zarar).
 * 4. GRNI ters kaydı ERTESİ YILIN dönemine yazılır; kapanış fişleri kapanan yılın dönemine.
 */
describe('YearEndClosingService', () => {
  const account = (id: string, code: string, name: string): Account =>
    ({
      id,
      code,
      name,
      isActive: true,
      isPostable: true,
    }) as unknown as Account;

  const SALES = account('acc-600', '600', 'Yurtiçi Satışlar');
  const EXPENSE = account('acc-770', '770', 'Genel Yönetim Giderleri');
  const REFLECT_771 = account('acc-771', '771', 'Genel Yönetim Gid. Yansıtma');
  const TARGET_632 = account('acc-632', '632', 'Genel Yönetim Giderleri (-)');
  const CASH = account('acc-100', '100', 'Kasa');
  const STOCK = account('acc-150', '150', 'İlk Madde ve Malzeme');
  const GRNI = account('acc-329', '329', 'Diğer Ticari Borçlar');
  const POOL = account('acc-690', '690', 'Dönem Kârı/Zararı');
  const NET_PROFIT = account('acc-590', '590', 'Dönem Net Kârı');
  const NET_LOSS = account('acc-591', '591', 'Dönem Net Zararı');

  const accounts = [
    SALES,
    EXPENSE,
    REFLECT_771,
    TARGET_632,
    CASH,
    STOCK,
    GRNI,
    POOL,
    NET_PROFIT,
    NET_LOSS,
  ];

  const ENDS_AT = new Date('2026-12-31T20:59:59.999Z');
  const NEXT_STARTS_AT = new Date('2026-12-31T21:00:00.000Z');

  const row = (
    accountId: string,
    debit: number,
    credit: number
  ): TrialBalanceRow => ({
    accountId,
    totalDebit: new Prisma.Decimal(debit),
    totalCredit: new Prisma.Decimal(credit),
  });

  const generate = (
    rows: TrialBalanceRow[],
    options: {
      accruals?: ClosingAccrual[];
      nextPeriodId?: string | null;
      chart?: Account[];
    } = {}
  ) => {
    const chart = options.chart ?? accounts;
    const plan = planYearEndClosing({
      balances: YearEndClosingService.toClosingBalances({
        trialBalanceRows: rows,
        accounts: chart,
      }),
      periodEndsAt: ENDS_AT,
      nextPeriodStartsAt: NEXT_STARTS_AT,
      accruals: options.accruals ?? [],
      businessType: null,
    });
    return YearEndClosingService.buildEntries({
      clinicId: 'clinic-1',
      organizationId: 'org-1',
      performedById: 'firebase-uid-1',
      closingPeriodId: 'period-2026',
      nextPeriodId:
        options.nextPeriodId === undefined
          ? 'period-2027'
          : options.nextPeriodId,
      plan,
      resolver: new AccountResolver(chart),
    });
  };

  const draftOf = (
    drafts: ReturnType<typeof generate>,
    step: ReturnType<typeof generate>[number]['step']
  ) => drafts.find((d) => d.step === step)?.entry;

  it('kapanış fişlerinin hepsi CLOSING niteliğindedir (P0)', () => {
    const drafts = generate([row(SALES.id, 0, 1000), row(EXPENSE.id, 400, 0)]);

    expect(drafts.map((d) => d.step)).toEqual([
      'COST_REFLECTION',
      'COST_REFLECTION_CLOSE',
      'CLOSE_TO_RESULT',
      'RESULT_TRANSFER',
    ]);
    for (const { entry } of drafts) {
      expect(entry.kind).toBe('CLOSING');
      // Persistence'a da taşınmalı: mapping düşürürse kolon varsayılanı
      // (OPERATIONAL) yazılır ve hata DB'de kalıcı olur.
      expect(entry.toPersistence().kind).toBe('CLOSING');
      expect(entry.isBalanced).toBe(true);
    }
  });

  it('7/A gideri 6. sınıfa yansıtılır; 690 kapanışı 770’i değil 632’yi taşır', () => {
    const drafts = generate([row(SALES.id, 0, 1000), row(EXPENSE.id, 400, 0)]);

    const reflection = draftOf(drafts, 'COST_REFLECTION')!;
    expect(
      reflection.lines.items
        .find((l) => l.accountId === TARGET_632.id)
        ?.debit.toString()
    ).toBe('400');
    expect(
      reflection.lines.items
        .find((l) => l.accountId === REFLECT_771.id)
        ?.credit.toString()
    ).toBe('400');

    const closing = draftOf(drafts, 'CLOSE_TO_RESULT')!;
    const closed = closing.lines.items.map((l) => l.accountId);
    expect(closed).toContain(TARGET_632.id);
    expect(closed).not.toContain(EXPENSE.id);
  });

  it('bilanço hesabını kapatmaz — yalnız 6/7 sonuç hesapları', () => {
    const drafts = generate([
      row(SALES.id, 0, 1000),
      row(EXPENSE.id, 400, 0),
      row(CASH.id, 5000, 0), // 100 Kasa: devreder, kapatılmaz
    ]);

    for (const { entry } of drafts) {
      expect(entry.lines.items.map((l) => l.accountId)).not.toContain(CASH.id);
    }
  });

  it('kârda 690 alacaklanır, devir fişi 690 → 590 yapar', () => {
    const drafts = generate([row(SALES.id, 0, 1000), row(EXPENSE.id, 400, 0)]);
    const entryA = draftOf(drafts, 'CLOSE_TO_RESULT')!;
    const entryB = draftOf(drafts, 'RESULT_TRANSFER')!;

    // Fiş A: 600 borçlandırılır (1000), 632 alacaklandırılır (400),
    // fark (600) 690'a alacak olarak yazılır → fiş dengeli.
    const poolLineA = entryA.lines.items.find((l) => l.accountId === POOL.id);
    expect(poolLineA?.credit.toString()).toBe('600');
    expect(entryA.isBalanced).toBe(true);

    // Fiş B: 690 borçlandırılır, 590 alacaklandırılır (kâr öz kaynağa taşınır).
    expect(
      entryB.lines.items.find((l) => l.accountId === POOL.id)?.debit.toString()
    ).toBe('600');
    expect(
      entryB.lines.items
        .find((l) => l.accountId === NET_PROFIT.id)
        ?.credit.toString()
    ).toBe('600');
    expect(entryB.isBalanced).toBe(true);
  });

  it('zararda devir 591 → 690 yönünde kurulur', () => {
    const entryB = draftOf(
      generate([row(SALES.id, 0, 400), row(EXPENSE.id, 1000, 0)]),
      'RESULT_TRANSFER'
    )!;

    // Zarar öz kaynağı AZALTIR: 591 borçlanır. Yön ters kurulsaydı zarar bilançoda kâr
    // gibi görünürdü ve fiş yine dengeli olacağı için fark edilmezdi.
    expect(
      entryB.lines.items
        .find((l) => l.accountId === NET_LOSS.id)
        ?.debit.toString()
    ).toBe('600');
    expect(
      entryB.lines.items.find((l) => l.accountId === POOL.id)?.credit.toString()
    ).toBe('600');
  });

  it('kapatılacak sonuç hesabı yoksa fiş üretilmez (ikinci kapanış mükerrer yazmaz)', () => {
    // Birinci kapanıştan sonra 6/7 bakiyeleri sıfırdır; dönem yeniden açılıp
    // tekrar kapatılsa mizan bu hâli gösterir ve yeni fiş çıkmaz.
    expect(
      generate([row(SALES.id, 1000, 1000), row(CASH.id, 5000, 0)])
    ).toEqual([]);
    expect(generate([])).toEqual([]);
  });

  it('690 havuz hesabının kendisi kapatılmaz (sonsuz döngü / mükerrer kapatma)', () => {
    const entryA = draftOf(
      generate([row(SALES.id, 0, 1000), row(POOL.id, 0, 250)]),
      'CLOSE_TO_RESULT'
    )!;

    // 690 kapatma listesine girmemeli: SUMMARY_ACCOUNT_PREFIX ('69') dışlanır.
    // Girseydi havuz hem kapatılan hem dengeleyen hesap olurdu.
    const poolLines = entryA.lines.items.filter((l) => l.accountId === POOL.id);
    expect(poolLines).toHaveLength(1); // yalnız dengeleyen satır
    expect(poolLines[0].credit.toString()).toBe('1000');
  });

  describe('GRNI tahakkuku', () => {
    const accrual: ClosingAccrual = {
      orderId: 'o1',
      debitAccountCode: '150',
      amount: new Decimal('300.00'),
      label: 'Sipariş o1',
    };

    it('tahakkuk ve ters kayıt ADJUSTING’tir; kapanış fişleri CLOSING kalır', () => {
      const drafts = generate([row(SALES.id, 0, 1000)], {
        accruals: [accrual],
      });

      expect(draftOf(drafts, 'GRNI_ACCRUAL')?.kind).toBe('ADJUSTING');
      expect(draftOf(drafts, 'GRNI_REVERSAL')?.kind).toBe('ADJUSTING');
      expect(draftOf(drafts, 'CLOSE_TO_RESULT')?.kind).toBe('CLOSING');
      expect(draftOf(drafts, 'RESULT_TRANSFER')?.kind).toBe('CLOSING');
    });

    it('ters kayıt ERTESİ YILIN dönemine, tahakkuk kapanan yılın dönemine yazılır', () => {
      const drafts = generate([row(SALES.id, 0, 1000)], {
        accruals: [accrual],
      });

      const periodOf = (step: string) =>
        drafts.find((d) => d.step === step)?.entry.toPersistence().periodId;
      expect(periodOf('GRNI_ACCRUAL')).toBe('period-2026');
      expect(periodOf('CLOSE_TO_RESULT')).toBe('period-2026');
      expect(periodOf('GRNI_REVERSAL')).toBe('period-2027');
      expect(
        draftOf(drafts, 'GRNI_REVERSAL')?.toPersistence().entryDate
      ).toEqual(NEXT_STARTS_AT);
    });

    it('ertesi yıl dönemi verilmeden ters kayıt taslağı kurulamaz', () => {
      expect(() =>
        generate([row(SALES.id, 0, 1000)], {
          accruals: [accrual],
          nextPeriodId: null,
        })
      ).toThrow(ClosingNextPeriodRequiredException);
    });

    it('tahakkuk eşlemesi tam: 329 alacak, 150 borç, fiş dengeli', () => {
      const entry = draftOf(
        generate([row(SALES.id, 0, 1000)], { accruals: [accrual] }),
        'GRNI_ACCRUAL'
      )!;

      expect(
        entry.lines.items
          .find((l) => l.accountId === GRNI.id)
          ?.credit.toString()
      ).toBe('300');
      expect(
        entry.lines.items
          .find((l) => l.accountId === STOCK.id)
          ?.debit.toString()
      ).toBe('300');
      expect(entry.isBalanced).toBe(true);
    });
  });

  describe('hesap planı eksikleri', () => {
    it('kapanışın yazacağı hesap planında yoksa fiş kurulamaz (sessizce atlanmaz)', () => {
      // 632 (şablona sonradan eklendi) mevcut kliniklerde bulunmayabilir.
      const chartWithout632 = accounts.filter((a) => a.id !== TARGET_632.id);

      expect(() =>
        generate([row(SALES.id, 0, 1000), row(EXPENSE.id, 400, 0)], {
          chart: chartWithout632,
        })
      ).toThrow(AccountCodeNotFoundException);
    });

    it('mizan satırının hesabı hesap planında yoksa durur', () => {
      expect(() =>
        YearEndClosingService.toClosingBalances({
          trialBalanceRows: [row('acc-bilinmeyen', 10, 0)],
          accounts,
        })
      ).toThrow();
    });
  });

  it('isResultAccount: 6/7 sonuç, 69x ve bilanço sonuç değildir', () => {
    expect(YearEndClosingService.isResultAccount('600.01')).toBe(true);
    expect(YearEndClosingService.isResultAccount('770')).toBe(true);
    expect(YearEndClosingService.isResultAccount('690')).toBe(false);
    expect(YearEndClosingService.isResultAccount('591')).toBe(false);
    expect(YearEndClosingService.isResultAccount('100')).toBe(false);
  });
});
