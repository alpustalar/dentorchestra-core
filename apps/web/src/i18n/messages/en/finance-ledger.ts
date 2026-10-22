const financeLedger = {
  FinanceLedger: {
    eyebrow: 'Clinic ledger · collections and expenses',
    demoData: 'Demo data',
    title: 'Finance ledger',
    description:
      'Review the clinic ledger of collections, refunds, and expenses; see the summary and reconciliation status for the selected range.',
    noSession: 'Sign in to view the finance ledger.',
    noClinic: 'No authorized clinic scope is available. The ledger was not loaded.',
    from: 'From',
    to: 'To',
    invalidRange: 'The start date cannot be after the end date.',
    loadError: 'Could not load summary or reconciliation data.',

    summaryTitle: 'Period summary',
    summaryDescription:
      'Totals of completed entries by currency for the selected date range.',
    noSummary: 'No completed entries were found for the selected range.',
    income: 'Income',
    expenses: 'Expenses',
    balance: 'Balance',
    entryCount: '{count} entries',

    reconciliationTitle: 'Reconciliation',
    reconciliationClean: 'No mismatches',
    reconciliationCleanDescription:
      'No mismatch was found between collections/refunds and the ledger for the selected range.',
    reconcileTitle: 'Ledger mismatch found',
    reconcileDescription:
      '{count} records have a mismatch between their collection/refund status and the ledger. Backfill produces missing entries and aligns entries whose status has drifted.',
    reconcileConfirm: 'I confirm running the backfill for the selected range.',
    reconcileWarning:
      'This action cannot be undone; it only fixes missing or drifted entries and does not change existing correct entries.',
    backfill: 'Backfill',
    backfilling: 'Backfilling…',
    backfillError: 'The backfill operation failed.',
    backfillSuccess: 'Backfill completed; the ledger and summary were refreshed.',
    mismatchKind: 'Kind',
    mismatchInstallment: 'Installment',
    mismatchPayment: 'Payment',
    mismatchPatient: 'Patient',
    mismatchSettledAt: 'Settled at',
    mismatchExpectedStatus: 'Expected status',
    mismatchLedgerStatus: 'Ledger status',
    mismatchMissing: 'No entry',

    listTitle: 'Ledger entries',
    listDescription:
      'All entries in the clinic ledger; the date range filter does not apply to this list.',
    searchPlaceholder: 'Search by description',
    search: 'Search',
    sortEntryDate: 'Sort by date',
    sortAmount: 'Sort by amount',
    sortAscending: 'Switch to ascending',
    sortDescending: 'Switch to descending',
    loading: 'Loading ledger…',
    empty: 'No ledger entry was found for this clinic.',
    noResults: 'No ledger entry matches the search.',
    noDescription: 'No description',
    noDocument: 'No document number',
    noPatient: 'Not linked to a patient',

    columnDate: 'Date',
    columnType: 'Type',
    columnCategory: 'Category',
    columnSource: 'Source',
    columnStatus: 'Status',
    columnDescription: 'Description',
    columnPatient: 'Patient',
    columnAmount: 'Amount',
    columnTax: 'Tax',

    previous: 'Previous',
    next: 'Next',
    page: 'Page {page} of {totalPages}',

    type: {
      INCOME: 'Income',
      EXPENSE: 'Expense',
    },
    category: {
      TREATMENT_PAYMENT: 'Treatment payment',
      REFUND: 'Refund',
      MATERIAL_PURCHASE: 'Material purchase',
      STOCK_ADJUSTMENT: 'Stock adjustment',
      SALARY: 'Salary',
      RENT: 'Rent',
      OTHER: 'Other',
    },
    source: {
      PAYMENT_MODULE: 'Payment module',
      INVENTORY_MODULE: 'Inventory module',
      MANUAL_ENTRY: 'Manual entry',
    },
    status: {
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded',
      CHARGED_BACK: 'Charged back',
    },
  },
} as const;

export default financeLedger;
