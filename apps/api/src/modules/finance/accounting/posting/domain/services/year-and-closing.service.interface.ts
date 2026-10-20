import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';
import { TrialBalanceRow } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { AccountResolver } from '@modules/finance/accounting/posting/domain/posting/account-resolver';
import {
  ClosingAccrual,
  ClosingBalance,
  YearEndClosingPlan,
} from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import { Account } from '@shared';
import type {
  YearEndClosingEntryPeriod,
  YearEndClosingStepType,
} from '@shared/modules/accounting-period/interfaces';

/** Mizan satırı → planlayıcının hesap KODU ile çalışan girdisi. */
export interface ToClosingBalancesProps {
  trialBalanceRows: readonly TrialBalanceRow[];
  accounts: readonly Account[];
}

export interface BuildClosingEntriesProps {
  clinicId: string;
  organizationId: string;
  performedById?: string | null;
  /** Kapanan yılın dönemi: planın `CLOSING_PERIOD` adımları buraya yazılır. */
  closingPeriodId: string;
  /** Ertesi yılın dönemi: yalnız GRNI ters kaydı (`NEXT_PERIOD`) buraya yazılır. */
  nextPeriodId: string | null;
  plan: YearEndClosingPlan;
  resolver: AccountResolver;
}

/** Plandaki bir adımın fiş taslağı + hangi döneme / hangi numara akışına gireceği. */
export interface ClosingEntryDraft {
  step: YearEndClosingStepType;
  period: YearEndClosingEntryPeriod;
  entry: JournalEntry;
}

export interface PlanClosingProps extends ToClosingBalancesProps {
  periodEndsAt: Date;
  nextPeriodStartsAt: Date | null;
  accruals: readonly ClosingAccrual[];
}

export interface IYearEndClosingService {
  toClosingBalances(props: ToClosingBalancesProps): ClosingBalance[];
  buildEntries(props: BuildClosingEntriesProps): ClosingEntryDraft[];
  isResultAccount(code: string): boolean;
}
