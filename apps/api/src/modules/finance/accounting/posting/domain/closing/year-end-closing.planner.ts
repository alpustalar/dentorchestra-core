import { Decimal } from 'decimal.js';
import type {
  YearEndClosingEntryKind,
  YearEndClosingEntryPeriod,
  YearEndClosingStepType,
} from '@shared/modules/accounting-period/interfaces';
import { isPurchaseInvoiceLineAccountCode } from '@shared/common/constants';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { JOURNAL_DESCRIPTIONS } from '@modules/finance/shared/domain/constants/journal-descriptions.constant';
import {
  COST_REFLECTION_GROUPS,
  findCostReflectionGroup,
  isCostAccountOfGroup,
  isReflectionAccount,
  isResultAccountCode,
} from '@modules/finance/shared/domain/constants/year-end-closing.constant';
import {
  ClosingNextPeriodRequiredException,
  GrniAccrualNotEligibleException,
  UnmappedCostAccountException,
} from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';
import { UnmappedPurchaseInvoiceAccountException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Yıl sonu kapanış **planı** — saf fonksiyon, ne DB ne entity bilir.
 *
 * Aynı fonksiyonu iki yer çağırır: kapanış komutu (fişleri yazar) ve önizleme sorgusu (yazmadan
 * gösterir). Önizleme ile kapanışın ayrı kod yollarına sahip olması, muhasebecinin gördüğü
 * tutarla deftere yazılan tutarın sessizce ayrışmasının tarifidir; ikisinin tek kaynağı budur.
 *
 * Zincir, mizanın bellekteki bir kopyası üzerinde ADIM ADIM uygulanır: her adım bir öncekinin
 * sonucunu görür (yansıtma sonrası 7. sınıf sıfırlanmış, 6. sınıf maliyeti taşır; 690'a kapanış
 * bunun üstüne kurulur). Bu yüzden tüm adımlar tek çağrıda, başlangıç mizanından hesaplanır —
 * adımlar arasında DB'den yeniden okuma yoktur.
 *
 *   1. GRNI_ACCRUAL          B {150|gider} / A 329            (31.12, ADJUSTING) — seçildiyse
 *   2. COST_REFLECTION       B 622|631|632 / A 741|761|771    (31.12, CLOSING)
 *   3. COST_REFLECTION_CLOSE B 741|761|771 / A 740.xx|760|770 (31.12, CLOSING)
 *   4. CLOSE_TO_RESULT       6. sınıf → 690                   (31.12, CLOSING)
 *   5. RESULT_TRANSFER       690 → 590 (kâr) | 591 (zarar)    (31.12, CLOSING)
 *   6. EQUITY_CARRYFORWARD   590/591 → 570/580 | 500          (1 Ocak, ertesi yıl, CLOSING) — işletme biçimi seçiliyse
 *   7. GRNI_REVERSAL         1. adımın tersi                  (1 Ocak, ADJUSTING, ertesi yıl)
 *
 * **Devir (adım 6)** kliniğin işletme biçimine bağlıdır (kullanıcı seçer): şirket → 570 (kâr) / 580 (zarar),
 * şahıs işletmesi → 500 Sermaye. Biçim seçilmemişse (`null`, eski klinikler) devir atlanır ve sonuç
 * 590/591'de kalır; önizleme bunu uyarı olarak gösterir. Devir ertesi yılın 1 Ocak'ına yazılır: kapanan
 * yılın kesin bilançosunda sonuç 590/591'dedir, geçmiş yıl hesaplarına yeni yılda geçer.
 */

export interface ClosingBalance {
  code: string;
  /** Borç − alacak (defterde etkili fişler, dönem aralığında). */
  net: Decimal;
}

export interface ClosingAccrual {
  orderId: string;
  /** Tahakkukun borçlandığı hesap — alış faturası karşı hesap kümesinden. */
  debitAccountCode: string;
  /** KDV hariç, kuruş ölçeğinde, pozitif. Sunucuda hesaplanır; istemciden gelmez. */
  amount: Decimal;
  /** Satır açıklamasına geçen kimlik (ör. "Sipariş <id>"). */
  label: string;
}

export interface PlanYearEndClosingInput {
  balances: readonly ClosingBalance[];
  /** Kapanış fişlerinin tarihi (dönemin son anı). */
  periodEndsAt: Date;
  /** GRNI ters kaydının tarihi (ertesi yılın başlangıcı). Tahakkuk varsa zorunlu. */
  nextPeriodStartsAt: Date | null;
  accruals: readonly ClosingAccrual[];
  /**
   * Devir hedefini belirleyen işletme biçimi. `null` = seçilmemiş → devir adımı üretilmez. Doluysa ve
   * net sonuç sıfırdan farklıysa `nextPeriodStartsAt` zorunludur.
   */
  businessType: ClosingBusinessType | null;
}

export type ClosingBusinessType = 'COMPANY' | 'SOLE_PROPRIETOR';

export interface ClosingPlanLine {
  accountCode: string;
  debit: Decimal;
  credit: Decimal;
  lineDesc: string;
}

export interface ClosingPlanStep {
  step: YearEndClosingStepType;
  entryKind: YearEndClosingEntryKind;
  period: YearEndClosingEntryPeriod;
  entryDate: Date;
  description: string;
  lines: ClosingPlanLine[];
}

export interface YearEndClosingPlan {
  steps: ClosingPlanStep[];
  incomeTotal: Decimal;
  expenseTotal: Decimal;
  /** Pozitif: kâr, negatif: zarar. */
  netResult: Decimal;
  resultAccountCode: '590' | '591' | null;
  reflectedCostTotal: Decimal;
  grniAccrualTotal: Decimal;
}

const ZERO = new Decimal(0);

const { TARGET_ACCOUNTS } = ACCOUNTING_RULES;

const debitLine = (
  accountCode: string,
  amount: Decimal,
  lineDesc: string
): ClosingPlanLine => ({ accountCode, debit: amount, credit: ZERO, lineDesc });

const creditLine = (
  accountCode: string,
  amount: Decimal,
  lineDesc: string
): ClosingPlanLine => ({ accountCode, debit: ZERO, credit: amount, lineDesc });

/**
 * İşaretli net'e göre satır: pozitif → borç, negatif → alacak.
 *
 * Sıfır için çağrılmaz: sıfır tutarlı satır yevmiye satırı değişmezini ihlal eder. NOT: decimal.js'te
 * `isPositive()` sıfır için de `true` döner (işaret bitine bakar) — bu dosyada "sıfırdan büyük" sorusu
 * her yerde `gt(0)` / `lt(0)` ile sorulur.
 */
const lineOfNet = (
  accountCode: string,
  net: Decimal,
  lineDesc: string
): ClosingPlanLine => {
  if (net.isZero()) {
    throw new Error(`Sıfır tutarlı kapanış satırı üretilemez: ${accountCode}`);
  }
  return net.lt(0)
    ? creditLine(accountCode, net.abs(), lineDesc)
    : debitLine(accountCode, net, lineDesc);
};

export function planYearEndClosing(
  input: PlanYearEndClosingInput
): YearEndClosingPlan {
  const net = new Map<string, Decimal>();
  for (const balance of input.balances) {
    net.set(balance.code, (net.get(balance.code) ?? ZERO).plus(balance.net));
  }
  const add = (code: string, delta: Decimal) =>
    net.set(code, (net.get(code) ?? ZERO).plus(delta));

  assertNoUnmappedCostAccounts(net);

  const steps: ClosingPlanStep[] = [];
  const entryDate = input.periodEndsAt;

  // ── 1) GRNI tahakkuku ────────────────────────────────────────────────────────────────
  let grniAccrualTotal = ZERO;
  const accrualLines: ClosingPlanLine[] = [];
  const reversalLines: ClosingPlanLine[] = [];

  if (input.accruals.length > 0) {
    if (!input.nextPeriodStartsAt)
      throw new ClosingNextPeriodRequiredException();

    for (const accrual of input.accruals) {
      // Savunma hattı: DTO ve çağıran handler zaten doğrular; planlayıcı bağımsız çağrılabilir.
      if (!isPurchaseInvoiceLineAccountCode(accrual.debitAccountCode)) {
        throw new UnmappedPurchaseInvoiceAccountException({
          lineAccountCode: accrual.debitAccountCode,
        });
      }
      if (!accrual.amount.isFinite() || !accrual.amount.gt(0)) {
        throw new GrniAccrualNotEligibleException({
          orderId: accrual.orderId,
          reason: 'NOT_A_CANDIDATE',
        });
      }

      const desc = `${JOURNAL_DESCRIPTIONS.GRNI_ACCRUAL}: ${accrual.label}`;
      accrualLines.push(
        debitLine(accrual.debitAccountCode, accrual.amount, desc),
        creditLine(TARGET_ACCOUNTS.GRNI_ACCRUAL_329, accrual.amount, desc)
      );
      // Ters kayıt aynı tutarın aynası: tahakkuk ile ters kaydın tutarı AYRI hesaplanmaz.
      const reversalDesc = `${JOURNAL_DESCRIPTIONS.GRNI_REVERSAL}: ${accrual.label}`;
      reversalLines.push(
        creditLine(accrual.debitAccountCode, accrual.amount, reversalDesc),
        debitLine(
          TARGET_ACCOUNTS.GRNI_ACCRUAL_329,
          accrual.amount,
          reversalDesc
        )
      );
      add(accrual.debitAccountCode, accrual.amount);
      add(TARGET_ACCOUNTS.GRNI_ACCRUAL_329, accrual.amount.negated());
      grniAccrualTotal = grniAccrualTotal.plus(accrual.amount);
    }

    steps.push({
      step: 'GRNI_ACCRUAL',
      entryKind: 'ADJUSTING',
      period: 'CLOSING_PERIOD',
      entryDate,
      description: JOURNAL_DESCRIPTIONS.GRNI_ACCRUAL,
      lines: accrualLines,
    });
  }

  // ── 2-3) 7/A maliyet yansıtması ───────────────────────────────────────────────────────
  const reflectionLines: ClosingPlanLine[] = [];
  const reflectionCloseLines: ClosingPlanLine[] = [];
  let reflectedCostTotal = ZERO;

  for (const group of COST_REFLECTION_GROUPS) {
    const costBalances = [...net.entries()]
      .filter(
        ([code, value]) => isCostAccountOfGroup(code, group) && !value.isZero()
      )
      .sort(([a], [b]) => a.localeCompare(b));
    const reflectionBefore = net.get(group.reflectionAccountCode) ?? ZERO;

    if (costBalances.length === 0 && reflectionBefore.isZero()) continue;

    // S: maliyet hesaplarının net'i. T: hedefe yansıtılan (yansıtma hesabının kendi bakiyesi dahil —
    // normalde sıfırdır; sıfır değilse hedef onu da taşır ki kontra hesap sıfırlansın).
    const costNet = costBalances.reduce(
      (sum, [, value]) => sum.plus(value),
      ZERO
    );
    const reflected = costNet.plus(reflectionBefore);
    const desc = JOURNAL_DESCRIPTIONS.COST_REFLECTION;

    if (!reflected.isZero()) {
      // T > 0: B hedef / A yansıtma.  T < 0: tersi.
      reflectionLines.push(
        lineOfNet(group.targetAccountCode, reflected, desc),
        lineOfNet(group.reflectionAccountCode, reflected.negated(), desc)
      );
      add(group.targetAccountCode, reflected);
      add(group.reflectionAccountCode, reflected.negated());
      reflectedCostTotal = reflectedCostTotal.plus(reflected);
    }

    // Kapanış: her maliyet hesabı kendi bakiyesiyle sıfırlanır; yansıtma hesabı S kadar kapanır.
    const closeDesc = JOURNAL_DESCRIPTIONS.COST_REFLECTION_CLOSE;
    for (const [code, value] of costBalances) {
      reflectionCloseLines.push(lineOfNet(code, value.negated(), closeDesc));
      add(code, value.negated());
    }
    if (!costNet.isZero()) {
      reflectionCloseLines.push(
        lineOfNet(group.reflectionAccountCode, costNet, closeDesc)
      );
      add(group.reflectionAccountCode, costNet);
    }
  }

  if (reflectionLines.length > 0) {
    steps.push({
      step: 'COST_REFLECTION',
      entryKind: 'CLOSING',
      period: 'CLOSING_PERIOD',
      entryDate,
      description: JOURNAL_DESCRIPTIONS.COST_REFLECTION,
      lines: reflectionLines,
    });
  }
  if (reflectionCloseLines.length > 0) {
    steps.push({
      step: 'COST_REFLECTION_CLOSE',
      entryKind: 'CLOSING',
      period: 'CLOSING_PERIOD',
      entryDate,
      description: JOURNAL_DESCRIPTIONS.COST_REFLECTION_CLOSE,
      lines: reflectionCloseLines,
    });
  }

  // ── 4-5) Sonuç hesaplarını 690'a, 690'ı 590/591'e kapat ──────────────────────────────
  let incomeTotal = ZERO;
  let expenseTotal = ZERO;
  const closingLines: ClosingPlanLine[] = [];

  const resultBalances = [...net.entries()]
    .filter(([code, value]) => isResultAccountCode(code) && !value.isZero())
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [code, value] of resultBalances) {
    const desc = `${JOURNAL_DESCRIPTIONS.CLOSING_PREFIX}: ${code}`;
    if (value.gt(0)) {
      // Gider (borç bakiye) → kapatmak için alacaklandır.
      closingLines.push(creditLine(code, value, desc));
      expenseTotal = expenseTotal.plus(value);
    } else {
      // Gelir (alacak bakiye) → kapatmak için borçlandır.
      closingLines.push(debitLine(code, value.negated(), desc));
      incomeTotal = incomeTotal.plus(value.negated());
    }
  }

  const netResult = incomeTotal.minus(expenseTotal);
  let resultAccountCode: '590' | '591' | null = null;

  if (closingLines.length > 0) {
    if (netResult.gt(0)) {
      closingLines.push(
        creditLine(
          TARGET_ACCOUNTS.POOL_690,
          netResult,
          JOURNAL_DESCRIPTIONS.PERIOD_PROFIT
        )
      );
    } else if (netResult.lt(0)) {
      closingLines.push(
        debitLine(
          TARGET_ACCOUNTS.POOL_690,
          netResult.negated(),
          JOURNAL_DESCRIPTIONS.PERIOD_LOSS
        )
      );
    }

    steps.push({
      step: 'CLOSE_TO_RESULT',
      entryKind: 'CLOSING',
      period: 'CLOSING_PERIOD',
      entryDate,
      description: JOURNAL_DESCRIPTIONS.YEAR_END_INCOME_EXPENSE_CLOSING,
      lines: closingLines,
    });

    if (!netResult.isZero()) {
      const profit = netResult.gt(0);
      resultAccountCode = profit
        ? TARGET_ACCOUNTS.NET_PROFIT_590
        : TARGET_ACCOUNTS.NET_LOSS_591;
      const amount = netResult.abs();

      steps.push({
        step: 'RESULT_TRANSFER',
        entryKind: 'CLOSING',
        period: 'CLOSING_PERIOD',
        entryDate,
        description: JOURNAL_DESCRIPTIONS.YEAR_END_PROFIT_LOSS_TRANSFER,
        lines: profit
          ? [
              debitLine(
                TARGET_ACCOUNTS.POOL_690,
                amount,
                JOURNAL_DESCRIPTIONS.NET_PROFIT_TRANSFER
              ),
              creditLine(
                TARGET_ACCOUNTS.NET_PROFIT_590,
                amount,
                JOURNAL_DESCRIPTIONS.NET_PROFIT
              ),
            ]
          : [
              debitLine(
                TARGET_ACCOUNTS.NET_LOSS_591,
                amount,
                JOURNAL_DESCRIPTIONS.NET_LOSS
              ),
              creditLine(
                TARGET_ACCOUNTS.POOL_690,
                amount,
                JOURNAL_DESCRIPTIONS.NET_LOSS_TRANSFER
              ),
            ],
      });
    }
  }

  // ── 6) Öz kaynağa devir: 590/591 → 570/580 (şirket) | 500 (şahıs), ertesi yılın 1 Ocak'ı ──────────
  if (input.businessType && resultAccountCode) {
    if (!input.nextPeriodStartsAt) throw new ClosingNextPeriodRequiredException();

    steps.push({
      step: 'EQUITY_CARRYFORWARD',
      entryKind: 'CLOSING',
      period: 'NEXT_PERIOD',
      entryDate: input.nextPeriodStartsAt,
      description: JOURNAL_DESCRIPTIONS.EQUITY_CARRYFORWARD,
      lines: equityCarryforwardLines({
        businessType: input.businessType,
        profit: netResult.gt(0),
        amount: netResult.abs(),
      }),
    });
  }

  // ── 7) GRNI ters kaydı: tahakkukun aynası, ertesi yılın 1 Ocak'ı ───────────────────────
  if (reversalLines.length > 0 && input.nextPeriodStartsAt) {
    steps.push({
      step: 'GRNI_REVERSAL',
      entryKind: 'ADJUSTING',
      period: 'NEXT_PERIOD',
      entryDate: input.nextPeriodStartsAt,
      description: JOURNAL_DESCRIPTIONS.GRNI_REVERSAL,
      lines: reversalLines,
    });
  }

  return {
    steps,
    incomeTotal,
    expenseTotal,
    netResult,
    resultAccountCode,
    reflectedCostTotal,
    grniAccrualTotal,
  };
}

/**
 * Devir satırları. Kâr: 590 borçlanır, hedef alacaklanır. Zarar: hedef borçlanır, 591 alacaklanır.
 * Hedef şirkette 570 (kâr) / 580 (zarar), şahısta her iki yönde 500.
 */
function equityCarryforwardLines(props: {
  businessType: ClosingBusinessType;
  profit: boolean;
  amount: Decimal;
}): ClosingPlanLine[] {
  const { businessType, profit, amount } = props;
  const company = businessType === 'COMPANY';

  if (profit) {
    const target = company
      ? TARGET_ACCOUNTS.RETAINED_EARNINGS_570
      : TARGET_ACCOUNTS.CAPITAL_500;
    const desc = company
      ? JOURNAL_DESCRIPTIONS.RETAINED_EARNINGS_TRANSFER
      : JOURNAL_DESCRIPTIONS.CAPITAL_PROFIT_TRANSFER;
    return [
      debitLine(TARGET_ACCOUNTS.NET_PROFIT_590, amount, desc),
      creditLine(target, amount, desc),
    ];
  }

  const target = company
    ? TARGET_ACCOUNTS.RETAINED_LOSSES_580
    : TARGET_ACCOUNTS.CAPITAL_500;
  const desc = company
    ? JOURNAL_DESCRIPTIONS.RETAINED_LOSSES_TRANSFER
    : JOURNAL_DESCRIPTIONS.CAPITAL_LOSS_TRANSFER;
  return [
    debitLine(target, amount, desc),
    creditLine(TARGET_ACCOUNTS.NET_LOSS_591, amount, desc),
  ];
}

/** Planın yazacağı tüm hesap kodları (hesap planında bulunma ön koşulu için). */
export function collectPlanAccountCodes(plan: YearEndClosingPlan): string[] {
  return [
    ...new Set(
      plan.steps.flatMap((step) => step.lines.map((l) => l.accountCode))
    ),
  ].sort();
}

/**
 * Bakiyesi olan her 7. sınıf hesap yansıtma eşlemesinde olmalıdır (maliyet hesabı ya da yansıtma
 * hesabı olarak). Aksi halde hesap doğrudan 690'a kapanır: kâr aynı, ama kesin mizanda maliyet
 * 7. sınıfta kalmış görünür — dengeli fiş, sessiz sapma.
 */
function assertNoUnmappedCostAccounts(net: Map<string, Decimal>): void {
  const unmapped = [...net.entries()]
    .filter(
      ([code, value]) =>
        code.startsWith('7') &&
        !value.isZero() &&
        findCostReflectionGroup(code) === null &&
        !isReflectionAccount(code)
    )
    .map(([code]) => code)
    .sort();

  if (unmapped.length > 0)
    throw new UnmappedCostAccountException({ codes: unmapped });
}
