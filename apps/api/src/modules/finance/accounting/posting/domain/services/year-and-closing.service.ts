import { JournalEntryKindSchema } from '@input-type-schemas/JournalEntryKindSchema';
import { Decimal } from 'decimal.js';
import { CreateJournalEntryLineProps } from '../contracts/journal-line';
import { JOURNAL_DESCRIPTIONS } from '@modules/finance/shared/domain/constants/journal-descriptions.constant';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { Account } from '@shared';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { GenerateClosingEntriesProps } from '@modules/finance/accounting/posting/domain/services/year-and-closing.service.interface';

export class YearEndClosingService {
  static generateClosingEntries(
    props: GenerateClosingEntriesProps
  ): JournalEntry[] {
    const { trialBalanceRows, resolver, accounts, ...commonProps } = props;
    const entries: JournalEntry[] = [];

    // O(1) erişim hızı için Map yapısını Account tipiyle kuruyoruz
    const accountById = new Map<string, Account>(
      accounts.map((a) => [a.id, a])
    );

    const closingLines: CreateJournalEntryLineProps[] = [];
    let incomeTotal = new Decimal(0);
    let expenseTotal = new Decimal(0);

    // 🚀 1. Mizan satırlarını analiz et ve kapanış kalemlerini topla
    for (const row of trialBalanceRows) {
      const account = accountById.get(row.accountId);
      if (!account || !this.isResultAccount(account.code)) continue;

      const net = new Decimal(row.totalDebit.toString()).minus(
        row.totalCredit.toString()
      );
      if (net.isZero()) continue;

      if (net.isPositive()) {
        // Gider (borç bakiye) → kapatmak için alacaklandır
        closingLines.push({
          accountId: account.id,
          credit: net,
          lineDesc: `${JOURNAL_DESCRIPTIONS.CLOSING_PREFIX}: ${account.code}`,
        });
        expenseTotal = expenseTotal.plus(net);
      } else {
        // Gelir (alacak bakiye) → kapatmak için borçlandır
        closingLines.push({
          accountId: account.id,
          debit: net.negated(),
          lineDesc: `${JOURNAL_DESCRIPTIONS.CLOSING_PREFIX}: ${account.code}`,
        });
        incomeTotal = incomeTotal.plus(net.negated());
      }
    }

    if (closingLines.length === 0) return []; // Kapatılacak sonuç hesabı hareketi yok

    // 🚀 2. FİŞ A: Gelir/Gider -> 690 Havuzu (Dengeleme iş kuralı)
    const profit = incomeTotal.minus(expenseTotal);
    const account690 = resolver.resolve(
      ACCOUNTING_RULES.TARGET_ACCOUNTS.POOL_690
    );

    const entryALines = [...closingLines];
    if (profit.isPositive()) {
      entryALines.push({
        accountId: account690.id,
        credit: profit,
        lineDesc: JOURNAL_DESCRIPTIONS.PERIOD_PROFIT,
      });
    } else if (profit.isNegative()) {
      entryALines.push({
        accountId: account690.id,
        debit: profit.negated(),
        lineDesc: JOURNAL_DESCRIPTIONS.PERIOD_LOSS,
      });
    }

    // Fiş A Aggregate üretimi (Kendi içinde Double-Entry kontrolü yapar)
    const entryA = JournalEntry.createDraft({
      ...commonProps,
      description: JOURNAL_DESCRIPTIONS.YEAR_END_INCOME_EXPENSE_CLOSING,
      eventId: null,
      // Kapanış fişi ekonomik bir olay değil, dönem sonu tekniğidir: 6/7'yi ters
      // kayıtla sıfırlar. İşaretlenmezse gelir tablosu onu da sayar ve kapanmış
      // yılın cirosu **sıfır** görünür (satırlar gerçek satışları birebir götürür).
      kind: JournalEntryKindSchema.enum.CLOSING,
      lines: entryALines,
    });
    entries.push(entryA);

    // 🚀 3. FİŞ B: 690 -> 590/591 Net K/Z Aktarımı
    if (!profit.isZero()) {
      const account590 = resolver.resolve(
        ACCOUNTING_RULES.TARGET_ACCOUNTS.NET_PROFIT_590
      );
      const account591 = resolver.resolve(
        ACCOUNTING_RULES.TARGET_ACCOUNTS.NET_LOSS_591
      );

      const entryBLines = profit.isPositive()
        ? [
            {
              accountId: account690.id,
              debit: profit,
              lineDesc: JOURNAL_DESCRIPTIONS.NET_PROFIT_TRANSFER,
            },
            {
              accountId: account590.id,
              credit: profit,
              lineDesc: JOURNAL_DESCRIPTIONS.NET_PROFIT,
            },
          ]
        : [
            {
              accountId: account591.id,
              debit: profit.negated(),
              lineDesc: JOURNAL_DESCRIPTIONS.NET_LOSS,
            },
            {
              accountId: account690.id,
              credit: profit.negated(),
              lineDesc: JOURNAL_DESCRIPTIONS.NET_LOSS_TRANSFER,
            },
          ];

      const entryB = JournalEntry.createDraft({
        ...commonProps,
        description: JOURNAL_DESCRIPTIONS.YEAR_END_PROFIT_LOSS_TRANSFER,
        eventId: null,
        kind: JournalEntryKindSchema.enum.CLOSING,
        lines: entryBLines,
      });
      entries.push(entryB);
    }

    return entries;
  }

  static isResultAccount(code: string): boolean {
    return (
      ACCOUNTING_RULES.RESULT_ACCOUNT_PREFIXES.some((p) =>
        code.startsWith(p)
      ) && !code.startsWith(ACCOUNTING_RULES.SUMMARY_ACCOUNT_PREFIX)
    );
  }
}
