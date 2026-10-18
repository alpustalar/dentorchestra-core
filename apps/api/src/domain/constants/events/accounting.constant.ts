export const ACCOUNTING_EVENTS = {
  TRIAL_BALANCE: 'accounting.report.trial-balance',
  ACCOUNT_LEDGER: 'accounting.report.account-ledger',
  JOURNAL_REPORT: 'accounting.report.journal',
  INCOME_STATEMENT: 'accounting.report.income-statement',
  BALANCE_SHEET: 'accounting.report.balance-sheet',
  CASH_FLOW: 'accounting.report.cash-flow',
  VAT_DECLARATION: 'accounting.report.vat-declaration',
  BANK_LEDGER_LINES: 'accounting.report.bank-ledger-lines',
  JOURNAL_ENTRIES: 'accounting.journal-entries.list',
  JOURNAL_REVERSE: 'accounting.journal-entries.reverse',
  YEAR_END_CLOSING: 'accounting.journal-entries.year-end-closing',
  CHART_OF_ACCOUNTS: 'accounting.chart-of-accounts.list',
  CHART_OF_ACCOUNTS_INITIALIZE: 'accounting.chart-of-accounts.initialize',
  CHART_OF_ACCOUNTS_DRIFT: 'accounting.chart-of-accounts.drift',
  PERIODS: 'accounting.periods.list',
  PERIOD_BY_DATE: 'accounting.periods.by-date',
  PERIOD_OPEN: 'accounting.periods.open',
  PERIOD_LOCK: 'accounting.periods.lock',
  PERIOD_REOPEN: 'accounting.periods.reopen',
  PERIOD_CLOSE: 'accounting.periods.close',
  UNPOSTED_FINANCIAL_EVENTS: 'accounting.financial-events.unposted',
  POST_UNPOSTED_FINANCIAL_EVENTS: 'accounting.financial-events.post-unposted',
  FINANCIAL_EVENTS: 'accounting.financial-events.list',
  FINANCIAL_EVENT_DETAIL: 'accounting.financial-events.detail',
  FINANCIAL_EVENTS_RECORD: 'accounting.financial-events.record',
  TAX_PARAMETERS: 'accounting.tax-parameters.list',
  TAX_PARAMETER_SET: 'accounting.tax-parameters.set',
} as const;

export type AccountingEvent =
  (typeof ACCOUNTING_EVENTS)[keyof typeof ACCOUNTING_EVENTS];

/** Hesap planı domain olayları (yetki eylem adlarından ayrıdır). */
export const CHART_OF_ACCOUNTS_EVENTS = {
  INITIALIZED: 'chart_of_accounts.initialized',
} as const;

export type ChartOfAccountsEvent =
  (typeof CHART_OF_ACCOUNTS_EVENTS)[keyof typeof CHART_OF_ACCOUNTS_EVENTS];

/** Muhasebe dönemi domain olayları (yetki eylem adlarından ayrıdır). */
export const ACCOUNTING_PERIOD_EVENTS = {
  OPENED: 'accounting_period.opened',
  LOCKED: 'accounting_period.locked',
  REOPENED: 'accounting_period.reopened',
  CLOSED: 'accounting_period.closed',
} as const;

export type AccountingPeriodEvent =
  (typeof ACCOUNTING_PERIOD_EVENTS)[keyof typeof ACCOUNTING_PERIOD_EVENTS];

/** Yevmiye fişi domain olayları (yetki eylem adlarından ayrıdır). */
export const JOURNAL_ENTRY_EVENTS = {
  REVERSED: 'journal_entry.reversed',
} as const;

export type JournalEntryEvent =
  (typeof JOURNAL_ENTRY_EVENTS)[keyof typeof JOURNAL_ENTRY_EVENTS];
