import { Decimal } from 'decimal.js';
import {
  ClosingAccrual,
  ClosingBalance,
  ClosingBusinessType,
  ClosingPlanStep,
  YearEndClosingPlan,
  collectPlanAccountCodes,
  planYearEndClosing,
} from './year-end-closing.planner';
import {
  ClosingNextPeriodRequiredException,
  GrniAccrualNotEligibleException,
  UnmappedCostAccountException,
} from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';
import { UnmappedPurchaseInvoiceAccountException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { isResultAccountCode } from '@modules/finance/shared/domain/constants/year-end-closing.constant';

/**
 * Yıl sonu kapanış planı — defterdeki en yüksek etkili YAZMA'nın saf çekirdeği.
 *
 * Kilitlenen iddialar:
 * 1. Her adım dengelidir ve adımlar mizana sırayla uygulandığında kapanan yılda 6. VE 7. sınıf
 *    hesapların hepsi sıfırlanır; sonuç 590/591'de durur (devir yok).
 * 2. 7/A maliyetleri 6. sınıfa YANSITILIR (740→622, 760→631, 770→632); doğrudan 690'a gitmez.
 * 3. Eşlemesiz 7xx hesap bakiyesi varsa kapanış sessizce geçmez, durur.
 * 4. GRNI tahakkuku 329'a yazar, ters kaydı ertesi yılın 1 Ocak'ında kendi tutarının aynasıdır;
 *    ikisi birlikte 329'u sıfırlar. Tahakkukun gider satırı kapanan yılın sonucuna girer.
 */
describe('planYearEndClosing', () => {
  const ENDS_AT = new Date('2026-12-31T20:59:59.999Z');
  const NEXT_STARTS_AT = new Date('2026-12-31T21:00:00.000Z');

  const bal = (code: string, debit: number, credit = 0): ClosingBalance => ({
    code,
    net: new Decimal(debit).minus(credit),
  });

  const plan = (
    balances: ClosingBalance[],
    options: {
      accruals?: ClosingAccrual[];
      next?: Date | null;
      businessType?: ClosingBusinessType | null;
    } = {}
  ): YearEndClosingPlan =>
    planYearEndClosing({
      balances,
      periodEndsAt: ENDS_AT,
      nextPeriodStartsAt:
        options.next === undefined ? NEXT_STARTS_AT : options.next,
      accruals: options.accruals ?? [],
      businessType: options.businessType ?? null,
    });

  const accrual = (
    orderId: string,
    debitAccountCode: string,
    amount: string
  ): ClosingAccrual => ({
    orderId,
    debitAccountCode,
    amount: new Decimal(amount),
    label: `Sipariş ${orderId}`,
  });

  const stepsOf = (p: YearEndClosingPlan) => p.steps.map((s) => s.step);
  const stepOf = (p: YearEndClosingPlan, type: ClosingPlanStep['step']) =>
    p.steps.find((s) => s.step === type);

  const totalDebit = (step: ClosingPlanStep) =>
    step.lines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
  const totalCredit = (step: ClosingPlanStep) =>
    step.lines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));

  /** Planı mizana SIRAYLA uygular (yalnız kapanan dönemdeki adımlar). */
  const applyToBalances = (
    balances: ClosingBalance[],
    p: YearEndClosingPlan,
    periods: ClosingPlanStep['period'][] = ['CLOSING_PERIOD']
  ): Map<string, Decimal> => {
    const net = new Map<string, Decimal>();
    for (const b of balances)
      net.set(b.code, (net.get(b.code) ?? new Decimal(0)).plus(b.net));
    for (const step of p.steps) {
      if (!periods.includes(step.period)) continue;
      for (const line of step.lines) {
        net.set(
          line.accountCode,
          (net.get(line.accountCode) ?? new Decimal(0))
            .plus(line.debit)
            .minus(line.credit)
        );
      }
    }
    return net;
  };

  const expectAllBalanced = (p: YearEndClosingPlan) => {
    for (const step of p.steps) {
      expect({
        step: step.step,
        debit: totalDebit(step).toFixed(2),
      }).toEqual({ step: step.step, debit: totalCredit(step).toFixed(2) });
      expect(totalDebit(step).isPositive()).toBe(true);
    }
  };

  const expectResultAccountsZero = (net: Map<string, Decimal>) => {
    for (const [code, value] of net) {
      if (isResultAccountCode(code)) {
        expect({ code, value: value.toFixed(2) }).toEqual({
          code,
          value: '0.00',
        });
      }
    }
  };

  // ───────────────────────────── temel zincir ─────────────────────────────

  it('kârlı yıl: yansıtma → 690 → 590; adımlar sıralı, hepsi dengeli, 6/7 sıfırlanır', () => {
    const balances = [
      bal('100', 5000),
      bal('600.01', 0, 1000),
      bal('770', 400),
    ];
    const p = plan(balances);

    expect(stepsOf(p)).toEqual([
      'COST_REFLECTION',
      'COST_REFLECTION_CLOSE',
      'CLOSE_TO_RESULT',
      'RESULT_TRANSFER',
    ]);
    expectAllBalanced(p);

    const after = applyToBalances(balances, p);
    expectResultAccountsZero(after);
    // Sonuç 590'da: alacak bakiye 600 (devir yok — 570'e gitmez).
    expect(after.get('590')?.toFixed(2)).toBe('-600.00');
    expect(after.get('690')?.toFixed(2)).toBe('0.00');
    // Bilanço hesabı kapatılmaz.
    expect(after.get('100')?.toFixed(2)).toBe('5000.00');

    expect(p.incomeTotal.toFixed(2)).toBe('1000.00');
    expect(p.expenseTotal.toFixed(2)).toBe('400.00');
    expect(p.netResult.toFixed(2)).toBe('600.00');
    expect(p.resultAccountCode).toBe('590');
  });

  it('zararlı yıl: 591 borçlanır, 690 alacaklanır', () => {
    const balances = [bal('600.01', 0, 400), bal('770', 1000)];
    const p = plan(balances);

    const transfer = stepOf(p, 'RESULT_TRANSFER')!;
    expect(
      transfer.lines.find((l) => l.accountCode === '591')?.debit.toFixed(2)
    ).toBe('600.00');
    expect(
      transfer.lines.find((l) => l.accountCode === '690')?.credit.toFixed(2)
    ).toBe('600.00');
    expect(p.resultAccountCode).toBe('591');
    expect(p.netResult.toFixed(2)).toBe('-600.00');
    expectAllBalanced(p);
    expectResultAccountsZero(applyToBalances(balances, p));
  });

  it('kâr/zarar sıfır: devir fişi yok, kapanış fişi yine dengeli', () => {
    const balances = [bal('600.01', 0, 500), bal('770', 500)];
    const p = plan(balances);

    expect(stepsOf(p)).not.toContain('RESULT_TRANSFER');
    expect(p.resultAccountCode).toBeNull();
    expectAllBalanced(p);
    expectResultAccountsZero(applyToBalances(balances, p));
  });

  it('kapatılacak sonuç hesabı yoksa hiç adım üretilmez (ikinci kapanış mükerrer yazmaz)', () => {
    expect(plan([bal('100', 5000)]).steps).toEqual([]);
    expect(plan([]).steps).toEqual([]);
    // Birinci kapanıştan sonra 6/7 sıfırdır.
    expect(plan([bal('600.01', 1000, 1000), bal('100', 5)]).steps).toEqual([]);
  });

  it('690 havuzunun kendisi kapatılmaz (69x hariç)', () => {
    const p = plan([bal('600.01', 0, 1000), bal('690', 0, 250)]);
    const closing = stepOf(p, 'CLOSE_TO_RESULT')!;
    expect(closing.lines.map((l) => l.accountCode)).toEqual(['600.01', '690']);
  });

  // ───────────────────────────── 7/A yansıtma ─────────────────────────────

  describe('7/A maliyet yansıtması', () => {
    it('üç grup hedeflerine gider: 740→622 (741), 760→631 (761), 770→632 (771)', () => {
      const balances = [
        bal('740.01', 300),
        bal('740.02', 200),
        bal('760', 100),
        bal('770', 50),
        bal('600.01', 0, 1000),
      ];
      const p = plan(balances);
      const reflection = stepOf(p, 'COST_REFLECTION')!;
      const find = (code: string) =>
        reflection.lines.find((l) => l.accountCode === code);

      expect(find('622')?.debit.toFixed(2)).toBe('500.00');
      expect(find('741')?.credit.toFixed(2)).toBe('500.00');
      expect(find('631')?.debit.toFixed(2)).toBe('100.00');
      expect(find('761')?.credit.toFixed(2)).toBe('100.00');
      expect(find('632')?.debit.toFixed(2)).toBe('50.00');
      expect(find('771')?.credit.toFixed(2)).toBe('50.00');
      expect(p.reflectedCostTotal.toFixed(2)).toBe('650.00');

      const close = stepOf(p, 'COST_REFLECTION_CLOSE')!;
      // Yansıtma hesapları borçlanarak, maliyet hesapları alacaklanarak kapanır.
      expect(
        close.lines.find((l) => l.accountCode === '741')?.debit.toFixed(2)
      ).toBe('500.00');
      expect(
        close.lines.find((l) => l.accountCode === '740.01')?.credit.toFixed(2)
      ).toBe('300.00');
      expect(
        close.lines.find((l) => l.accountCode === '740.02')?.credit.toFixed(2)
      ).toBe('200.00');

      expectAllBalanced(p);
      const after = applyToBalances(balances, p);
      expectResultAccountsZero(after);
      // Kâr = 1000 − 650.
      expect(after.get('590')?.toFixed(2)).toBe('-350.00');
      // Yansıtma hesapları kapanış sonunda sıfır.
      for (const code of ['741', '761', '771']) {
        expect(after.get(code)?.toFixed(2)).toBe('0.00');
      }
    });

    it('7xx maliyet doğrudan 690’a GİTMEZ: 690 kapanış satırları yalnız 6. sınıfı taşır', () => {
      const p = plan([bal('770', 400), bal('600.01', 0, 1000)]);
      const closing = stepOf(p, 'CLOSE_TO_RESULT')!;

      expect(closing.lines.map((l) => l.accountCode)).toEqual([
        '600.01',
        '632',
        '690',
      ]);
    });

    it('yansıtma hesabında önceden kalmış bakiye de hedefe taşınır, hesap sıfırlanır', () => {
      // Normalde 741/761/771'e hiçbir kural yazmaz; yazılmışsa sessizce 690'a kapanmamalı.
      const balances = [bal('740.01', 300), bal('741', 0, 100)];
      const p = plan(balances);
      const after = applyToBalances(balances, p);

      expectAllBalanced(p);
      expectResultAccountsZero(after);
      expect(after.get('741')?.toFixed(2)).toBe('0.00');
      expect(after.get('740.01')?.toFixed(2)).toBe('0.00');
      // Hedef 300 − 100 = 200 taşır → zarar 200.
      expect(p.expenseTotal.toFixed(2)).toBe('200.00');
    });

    it('aynı grupta karışık işaretli maliyet hesapları net’lenir ve ikisi de sıfırlanır', () => {
      const balances = [bal('740.01', 100), bal('740.02', 0, 100)];
      const p = plan(balances);

      // Net sıfır → yansıtma fişi yok; ama iki hesabın bakiyesi kapatılmalı.
      expect(stepsOf(p)).toEqual(['COST_REFLECTION_CLOSE']);
      expectAllBalanced(p);
      const after = applyToBalances(balances, p);
      expect(after.get('740.01')?.toFixed(2)).toBe('0.00');
      expect(after.get('740.02')?.toFixed(2)).toBe('0.00');
    });

    it('bakiyesi olan EŞLEMESİZ 7xx hesap kapanışı durdurur', () => {
      expect(() => plan([bal('750', 100), bal('600.01', 0, 500)])).toThrow(
        UnmappedCostAccountException
      );
    });

    it('eşlemesiz 7xx hesabın bakiyesi sıfırsa sorun çıkarmaz', () => {
      expect(() =>
        plan([bal('750', 100, 100), bal('600.01', 0, 500)])
      ).not.toThrow();
    });
  });

  // ───────────────────────────── GRNI ─────────────────────────────

  describe('GRNI tahakkuku', () => {
    it('stok tahakkuku: B 150 / A 329 (31.12, ADJUSTING) + ters kayıt (1 Ocak, ertesi yıl)', () => {
      const p = plan([bal('600.01', 0, 1000)], {
        accruals: [accrual('o1', '150', '300.00')],
      });

      const acc = stepOf(p, 'GRNI_ACCRUAL')!;
      expect(acc).toMatchObject({
        entryKind: 'ADJUSTING',
        period: 'CLOSING_PERIOD',
        entryDate: ENDS_AT,
      });
      expect(
        acc.lines.find((l) => l.accountCode === '150')?.debit.toFixed(2)
      ).toBe('300.00');
      expect(
        acc.lines.find((l) => l.accountCode === '329')?.credit.toFixed(2)
      ).toBe('300.00');

      const rev = stepOf(p, 'GRNI_REVERSAL')!;
      expect(rev).toMatchObject({
        entryKind: 'ADJUSTING',
        period: 'NEXT_PERIOD',
        entryDate: NEXT_STARTS_AT,
      });
      expect(
        rev.lines.find((l) => l.accountCode === '150')?.credit.toFixed(2)
      ).toBe('300.00');
      expect(
        rev.lines.find((l) => l.accountCode === '329')?.debit.toFixed(2)
      ).toBe('300.00');

      expect(p.grniAccrualTotal.toFixed(2)).toBe('300.00');
      expectAllBalanced(p);
    });

    it('329 tahakkuk + ters kayıtla sıfırlanır; yalnız 31.12’de açıktır', () => {
      const balances = [bal('600.01', 0, 1000)];
      const p = plan(balances, {
        accruals: [
          accrual('o1', '150', '300.00'),
          accrual('o2', '770', '120.50'),
        ],
      });

      const afterClosing = applyToBalances(balances, p, ['CLOSING_PERIOD']);
      expect(afterClosing.get('329')?.toFixed(2)).toBe('-420.50');

      const afterAll = applyToBalances(balances, p, [
        'CLOSING_PERIOD',
        'NEXT_PERIOD',
      ]);
      expect(afterAll.get('329')?.toFixed(2)).toBe('0.00');
      expect(afterAll.get('150')?.toFixed(2)).toBe('0.00');
    });

    it('gider tahakkuku kapanan yılın sonucuna girer; stok tahakkuku girmez', () => {
      // Tahakkuk olmadan: gelir 1000, gider yok → kâr 1000.
      const base = plan([bal('600.01', 0, 1000)]);
      expect(base.netResult.toFixed(2)).toBe('1000.00');

      const stock = plan([bal('600.01', 0, 1000)], {
        accruals: [accrual('o1', '150', '300.00')],
      });
      expect(stock.netResult.toFixed(2)).toBe('1000.00');

      const expense = plan([bal('600.01', 0, 1000)], {
        accruals: [accrual('o1', '770', '300.00')],
      });
      // 770 borçlandı → yansıtma → 632 → kapanış: kâr 700.
      expect(expense.netResult.toFixed(2)).toBe('700.00');
      expect(expense.expenseTotal.toFixed(2)).toBe('300.00');
    });

    it('yalnız stok tahakkuku olan, hiç sonuç hesabı olmayan yılda yine tahakkuk + ters kayıt üretilir', () => {
      const p = plan([bal('100', 5000)], {
        accruals: [accrual('o1', '150', '300.00')],
      });
      expect(stepsOf(p)).toEqual(['GRNI_ACCRUAL', 'GRNI_REVERSAL']);
    });

    it('tahakkuk satırlarının açıklaması siparişi taşır (kebirde izlenebilir)', () => {
      const p = plan([], { accruals: [accrual('ord-77', '150', '10.00')] });
      for (const line of stepOf(p, 'GRNI_ACCRUAL')!.lines) {
        expect(line.lineDesc).toContain('ord-77');
      }
      for (const line of stepOf(p, 'GRNI_REVERSAL')!.lines) {
        expect(line.lineDesc).toContain('ord-77');
      }
    });

    it('ertesi yıl başlangıcı yoksa tahakkuk reddedilir (ters kayıt yazılamaz)', () => {
      expect(() =>
        plan([], { accruals: [accrual('o1', '150', '10.00')], next: null })
      ).toThrow(ClosingNextPeriodRequiredException);
    });

    it.each(['102', '329', '120', '740'])(
      'borç hesabı %s alış faturası kabul kümesinde değil → reddedilir',
      (code) => {
        expect(() =>
          plan([], { accruals: [accrual('o1', code, '10.00')] })
        ).toThrow(UnmappedPurchaseInvoiceAccountException);
      }
    );

    it.each(['0', '-5', 'NaN'])(
      'tutar %s pozitif değil → reddedilir',
      (amount) => {
        expect(() =>
          plan([], { accruals: [accrual('o1', '150', amount)] })
        ).toThrow(GrniAccrualNotEligibleException);
      }
    );
  });

  // ───────────────────────── rastgele mizan (değişmez) ─────────────────────────

  describe('rastgele mizanlar', () => {
    /** Tohumlu, deterministik üreteç (property-test kütüphanesi yok). */
    const lcg = (seed: number) => {
      let state = seed >>> 0;
      return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    };

    const CODES = [
      '600.01',
      '600.02',
      '601',
      '602',
      '610',
      '611',
      '642',
      '646',
      '653',
      '656',
      '659.01',
      '679',
      '689',
      '740.01',
      '740.02',
      '740.03',
      '740.04',
      '760',
      '770',
      '100',
      '102',
      '120',
      '150',
      '320',
      '500',
    ];

    it('200 rastgele mizan: her adım dengeli, 6/7 sıfırlanır, 590−591 sonuca eşit', () => {
      for (let seed = 1; seed <= 200; seed += 1) {
        const rand = lcg(seed);
        const balances: ClosingBalance[] = [];
        for (const code of CODES) {
          if (rand() < 0.45) continue;
          // Kuruş ölçeğinde, iki yönlü tutarlar.
          const cents = Math.floor(rand() * 500000);
          const sign = rand() < 0.5 ? 1 : -1;
          balances.push({ code, net: new Decimal(sign * cents).div(100) });
        }
        // Tahakkuk: bazen var.
        const accruals =
          rand() < 0.5
            ? [
                accrual(
                  `o${seed}`,
                  rand() < 0.5 ? '150' : '770',
                  (1 + Math.floor(rand() * 9999)).toString() + '.25'
                ),
              ]
            : [];

        const p = plan(balances, { accruals });

        expectAllBalanced(p);
        // Kapanan YILIN defteri: 6/7 sıfır. (Ters kayıt ertesi yılın defterindedir; gider
        // satırı orada alacak olarak durur ve faturayla birlikte sıfırlanır.)
        const after = applyToBalances(balances, p, ['CLOSING_PERIOD']);
        expectResultAccountsZero(after);
        const afterBoth = applyToBalances(balances, p, [
          'CLOSING_PERIOD',
          'NEXT_PERIOD',
        ]);

        // Sonuç 590/591’de ve işareti netResult ile aynı; 690 sıfır.
        expect(after.get('690')?.toFixed(2) ?? '0.00').toBe('0.00');
        const before590 = balances
          .filter((b) => b.code === '590' || b.code === '591')
          .reduce((s, b) => s.plus(b.net), new Decimal(0));
        const moved = (after.get('590') ?? new Decimal(0))
          .plus(after.get('591') ?? new Decimal(0))
          .minus(before590);
        expect(moved.toFixed(2)).toBe(p.netResult.negated().toFixed(2));

        // 329 tahakkuk + ters kayıtla her zaman sıfır.
        expect((afterBoth.get('329') ?? new Decimal(0)).toFixed(2)).toBe(
          '0.00'
        );

        // Planın yazacağı her kod listelenebilir ve sıralıdır.
        const codes = collectPlanAccountCodes(p);
        expect(codes).toEqual([...codes].sort());
      }
    });
  });

  // ───────────────────── öz kaynağa devir (işletme biçimi) ─────────────────────

  describe('EQUITY_CARRYFORWARD (590/591 → 570/580 | 500)', () => {
    const profitBalances = [bal('600.01', 0, 1000), bal('770', 400)]; // net kâr 600
    const lossBalances = [bal('600.01', 0, 300), bal('770', 900)]; // net zarar 600

    const carry = (p: YearEndClosingPlan) =>
      stepOf(p, 'EQUITY_CARRYFORWARD');
    const lineOf = (step: ClosingPlanStep, code: string) =>
      step.lines.find((l) => l.accountCode === code);

    const cases: {
      name: string;
      type: ClosingBusinessType;
      balances: ClosingBalance[];
      debit: string;
      credit: string;
    }[] = [
      {
        name: 'şirket + kâr',
        type: 'COMPANY',
        balances: profitBalances,
        debit: '590',
        credit: '570',
      },
      {
        name: 'şirket + zarar',
        type: 'COMPANY',
        balances: lossBalances,
        debit: '580',
        credit: '591',
      },
      {
        name: 'şahıs + kâr',
        type: 'SOLE_PROPRIETOR',
        balances: profitBalances,
        debit: '590',
        credit: '500',
      },
      {
        name: 'şahıs + zarar',
        type: 'SOLE_PROPRIETOR',
        balances: lossBalances,
        debit: '500',
        credit: '591',
      },
    ];

    it.each(cases)(
      '$name: B $debit / A $credit, ertesi yılın 1 Ocak’ı, CLOSING, dengeli',
      ({ type, balances, debit, credit }) => {
        const p = plan(balances, { businessType: type });
        const step = carry(p)!;

        expect(step).toBeDefined();
        expect(step.period).toBe('NEXT_PERIOD');
        expect(step.entryKind).toBe('CLOSING');
        expect(step.entryDate).toEqual(NEXT_STARTS_AT);
        expect(lineOf(step, debit)!.debit.toFixed(2)).toBe('600.00');
        expect(lineOf(step, credit)!.credit.toFixed(2)).toBe('600.00');
        expect(step.lines).toHaveLength(2);
        expectAllBalanced(p);
      }
    );

    it('kapanan yılın defteri 590/591’de biter; devir ertesi yılda 590/591’i sıfırlar', () => {
      const p = plan(profitBalances, { businessType: 'COMPANY' });

      const closingYear = applyToBalances(profitBalances, p);
      expect(closingYear.get('590')!.toFixed(2)).toBe('-600.00');
      expect(closingYear.get('570')).toBeUndefined();

      const both = applyToBalances(profitBalances, p, [
        'CLOSING_PERIOD',
        'NEXT_PERIOD',
      ]);
      expect(both.get('590')!.toFixed(2)).toBe('0.00');
      expect(both.get('570')!.toFixed(2)).toBe('-600.00');
    });

    it('işletme biçimi seçilmemişse devir adımı üretilmez', () => {
      const p = plan(profitBalances, { businessType: null });
      expect(carry(p)).toBeUndefined();
      expect(stepsOf(p).at(-1)).toBe('RESULT_TRANSFER');
    });

    it('sonuç hareketi yoksa biçim dolu olsa da devir adımı üretilmez (sıfır tutarlı fiş yok)', () => {
      const p = plan([bal('100', 5000)], { businessType: 'COMPANY' });
      expect(p.steps).toEqual([]);
    });

    it('kâr sıfır (gelir = gider) ise devir adımı üretilmez', () => {
      const p = plan([bal('600.01', 0, 400), bal('770', 400)], {
        businessType: 'SOLE_PROPRIETOR',
      });
      expect(carry(p)).toBeUndefined();
    });

    it('biçim doluyken ertesi yıl tarihi yoksa durur (sessizce atlamaz)', () => {
      expect(() =>
        plan(profitBalances, { businessType: 'COMPANY', next: null })
      ).toThrow(ClosingNextPeriodRequiredException);
    });

    it('devir, GRNI ters kaydından ÖNCE gelir ve ikisi de ertesi yıla düşer', () => {
      const p = plan(profitBalances, {
        businessType: 'COMPANY',
        accruals: [accrual('o1', '150', '100.00')],
      });
      const steps = stepsOf(p);
      expect(steps.slice(-2)).toEqual(['EQUITY_CARRYFORWARD', 'GRNI_REVERSAL']);
      expectAllBalanced(p);
    });
  });
});
