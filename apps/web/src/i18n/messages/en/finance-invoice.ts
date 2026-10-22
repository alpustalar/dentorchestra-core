const financeInvoice = {
  FinanceInvoice: {
    eyebrow: 'Sales invoices · documents and reconciliation',
    demoData: 'Demo data',
    title: 'Sales invoices',
    description:
      'Review event-generated invoices, detect missing invoices, and run controlled recovery or cancellation when needed.',
    noSession: 'Sign in to view invoices.',
    noScope: 'No authorized organization and clinic scope is available.',
    totalLabel: 'Total invoices',
    loadError: 'Invoice or reconciliation data could not be loaded.',
    from: 'From',
    to: 'To',
    invalidRange: 'The start date cannot be after the end date.',

    reconciliationTitle: 'Missing invoice reconciliation',
    reconciliationDescription:
      'Settled payments that do not have an invoice in the selected date range.',
    reconciliationLoading: 'Checking reconciliation…',
    reconciliationClean: 'No missing invoices',
    reconciliationCleanDescription:
      'No settled payment without an invoice was found in the selected range.',
    missingTitle: '{count} missing invoices found',
    missingDescription:
      'The normal event flow did not create invoices for these payments. Recovery retries only this gap.',
    collectedAt: 'Collected at',
    payment: 'Payment',
    patient: 'Patient',
    amount: 'Amount',
    backfillConfirm:
      'I confirm invoice recovery for missing invoices in the selected range.',
    backfillWarning:
      'Existing invoices are not changed; only payments without an invoice are retried.',
    backfill: 'Recover missing invoices',
    backfilling: 'Recovering…',
    backfillError: 'Missing invoice recovery failed.',
    backfillSuccess:
      'Recovery completed: {attempted} attempted, {issued} issued, {failed} failed.',

    listTitle: 'Invoice list',
    listDescription:
      'Sales invoices in the clinic scope. The date range applies only to missing-invoice reconciliation.',
    searchPlaceholder: 'Search by invoice number',
    search: 'Search',
    loading: 'Loading invoices…',
    empty: 'No invoices were found for this clinic.',
    noResults: 'No invoice matched your search.',
    invoiceNumber: 'Invoice no.',
    issuedAt: 'Issue date',
    statusLabel: 'Status',
    actions: 'Actions',
    view: 'View',
    unassigned: 'Number pending',
    notIssued: 'Not issued yet',
    masked: 'Not authorized to view',
    previous: 'Previous',
    next: 'Next',
    page: 'Page {page} of {totalPages}',

    detailTitle: 'Invoice details',
    detailDescription: 'Document status, tax breakdown, and audit trail.',
    detailLoading: 'Loading invoice details…',
    detailError: 'Invoice details could not be loaded.',
    netTotal: 'Net total',
    vatTotal: 'VAT',
    vatRate: 'VAT rate',
    grandTotal: 'Grand total',
    clinic: 'Clinic',
    percent: '{value}%',
    cancelledTitle: 'Invoice cancelled',
    cancelReasonMissing: 'No cancellation reason is available.',
    cancelTitle: 'Cancel invoice',
    cancelDescription:
      'Cancellation voids the document and reverses its accounting effect.',
    cancelReason: 'Cancellation reason',
    cancelReasonPlaceholder:
      'Enter an auditable reason of at least 5 characters',
    cancelConfirm: 'I confirm that I want to cancel this invoice.',
    cancelWarning:
      'This cannot be undone; if an e-document was sent, an integrator cancellation will also be queued.',
    cancelInvoice: 'Cancel invoice',
    cancelling: 'Cancelling…',
    cancelSuccess: 'The invoice was cancelled and the list was updated.',
    cancelError: 'The invoice could not be cancelled.',
    cancelMissingSelection: 'No invoice was selected for cancellation.',

    status: {
      PENDING: 'Pending',
      ISSUED: 'Issued',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled',
    },
  },
} as const;

export default financeInvoice;
