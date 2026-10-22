const financePayroll = {
  FinancePayroll: {
    eyebrow: 'Clinic ledger · payroll accrual',
    demoData: 'Demo data',
    title: 'Payroll accrual',
    description:
      'Record gross-to-net figures already calculated outside the system (payroll software); finance only produces the accrual journal entry.',
    noSession: 'Sign in to view payroll accruals.',
    noClinic:
      'No authorized clinic scope is available. Accruals were not loaded.',
    totalLabel: 'Total accruals',
    newAccrual: 'New accrual',
    listTitle: 'Accrual history',
    listDescription:
      'There is no persistent payroll table; this list reads from the financial event ledger (PAYROLL_ACCRUED).',
    filterEmployee: 'Employee',
    filterAllEmployees: 'All employees',
    filterMonth: 'Month',
    applyFilter: 'Filter',
    clearFilter: 'Clear',
    filterPairHint:
      'Employee and month must be selected together; a single value is not applied.',
    loadError: 'Could not load accrual history.',
    loading: 'Loading accruals…',
    empty: 'No accrual is recorded for this clinic.',
    noResults: 'No accrual matches the selected employee and month.',
    employee: 'Employee',
    month: 'Month',
    grossSalary: 'Gross salary',
    employerSgk: 'Employer social security',
    netPayable: 'Net payable',
    taxWithholding: 'Withholding (income tax + stamp duty)',
    employeeSgk: 'Employee social security',
    createdAt: 'Recorded at',
    unknownEmployee: 'Unresolved party',
    partyIdLabel: 'Party ID',
    previous: 'Previous',
    next: 'Next',
    pagination: 'Page {page} of {totalPages} · {total} records',
    close: 'Close',
    detailTitle: 'Accrual details',
    detailDescription: 'The payroll breakdown of the financial event record.',
    detailLoading: 'Loading accrual details…',
    detailError: 'Could not load accrual details.',
    breakdownTitle: 'Payroll breakdown',
    systemInfo: 'System information',
    accountingHint:
      'This accrual is bridged to the accounting journal (770 / 335 + 360 + 361); track the entry status from Accounting → Journal entries.',
    newAccrualTitle: 'New payroll accrual',
    newAccrualDescription:
      'The gross-to-net calculation happens in payroll software; this only records the already-calculated figures.',
    selectEmployee: 'Select an employee',
    noPayableEmployee:
      'No active employee linked to a user account was found in this clinic.',
    accrualDate: 'Accrual date',
    accrualDateHint:
      'This date determines the accounting period; accrual into a sealed period is rejected.',
    balanceCheck:
      'Gross {gross} — net + withholding + employee social security {decomposed}. A mismatch is rejected server-side.',
    validationError: 'Please check the form fields.',
    submitError: 'Could not record the accrual.',
    recorded: 'Accrual recorded.',
    demoRecorded: 'In demo mode the accrual is not actually recorded.',
    recording: 'Recording…',
    record: 'Record',
  },
} as const;

export default financePayroll;
