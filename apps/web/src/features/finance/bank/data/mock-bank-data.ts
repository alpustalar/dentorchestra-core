import type {
  BankAccountResponseDto,
  BankStatementLineResponseDto,
  BankStatementResponseDto,
  CreateBankAccountDtoCurrency,
  ImportBankStatementDtoLinesItem,
  LineMatchSuggestionResponseDto,
  ReconciliationSummaryResponseDto,
} from '@/api/generated/model';

export function createDemoAccount(params: {
  id: string;
  name: string;
  bankName: string;
  currency: CreateBankAccountDtoCurrency;
  openingBalance: number;
  iban: string | null;
  accountNo: string | null;
}): BankAccountResponseDto {
  const now = new Date().toISOString();
  return {
    id: params.id,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    name: params.name,
    bankName: params.bankName,
    currency: params.currency,
    status: 'ACTIVE',
    openingBalance: params.openingBalance.toFixed(2),
    iban: params.iban,
    accountNo: params.accountNo,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDemoAccounts(): BankAccountResponseDto[] {
  return [
    createDemoAccount({
      id: 'demo-account-1',
      name: 'İş Bankası Ana Hesap',
      bankName: 'Türkiye İş Bankası',
      currency: 'TRY',
      openingBalance: 50000,
      iban: 'TR330006100519786457841326',
      accountNo: '1234567',
    }),
    createDemoAccount({
      id: 'demo-account-2',
      name: 'Garanti Masraf Hesabı',
      bankName: 'Garanti BBVA',
      currency: 'TRY',
      openingBalance: 12000,
      iban: null,
      accountNo: null,
    }),
    {
      ...createDemoAccount({
        id: 'demo-account-3',
        name: 'Eski Hesap',
        bankName: 'Ziraat Bankası',
        currency: 'TRY',
        openingBalance: 0,
        iban: null,
        accountNo: null,
      }),
      status: 'ARCHIVED',
    },
  ];
}

export function createDemoLine(params: {
  id: string;
  bankStatementId: string;
  bankAccountId: string;
  clinicId: string;
  transactionDate: string;
  description: string;
  amount: number;
  balanceAfter?: number | null;
  reference?: string | null;
  counterpartyName?: string | null;
  matchStatus?: BankStatementLineResponseDto['matchStatus'];
  matchSource?: BankStatementLineResponseDto['matchSource'];
  matchedRef?: string | null;
  matchNote?: string | null;
}): BankStatementLineResponseDto {
  return {
    id: params.id,
    bankStatementId: params.bankStatementId,
    bankAccountId: params.bankAccountId,
    clinicId: params.clinicId,
    organizationId: 'demo-organization',
    transactionDate: params.transactionDate,
    description: params.description,
    amount: params.amount.toFixed(2),
    balanceAfter:
      params.balanceAfter !== undefined && params.balanceAfter !== null
        ? params.balanceAfter.toFixed(2)
        : null,
    reference: params.reference ?? null,
    counterpartyName: params.counterpartyName ?? null,
    matchStatus: params.matchStatus ?? 'UNMATCHED',
    matchSource: params.matchSource ?? 'MANUAL',
    matchedRef: params.matchedRef ?? null,
    matchNote: params.matchNote ?? null,
    reconciledById: null,
    reconciledAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function createDemoStatement(params: {
  id: string;
  bankAccountId: string;
  clinicId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  closingBalance: number | null;
  fileName: string | null;
  lines: ImportBankStatementDtoLinesItem[];
}): BankStatementResponseDto {
  return {
    id: params.id,
    bankAccountId: params.bankAccountId,
    clinicId: params.clinicId,
    organizationId: 'demo-organization',
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    openingBalance:
      params.openingBalance !== null ? params.openingBalance.toFixed(2) : null,
    closingBalance:
      params.closingBalance !== null ? params.closingBalance.toFixed(2) : null,
    fileName: params.fileName,
    importedById: 'demo-user',
    lines: params.lines.map((line, index) =>
      createDemoLine({
        id: `${params.id}-line-${index}`,
        bankStatementId: params.id,
        bankAccountId: params.bankAccountId,
        clinicId: params.clinicId,
        transactionDate: line.transactionDate,
        description: line.description,
        amount: line.amount,
        balanceAfter: line.balanceAfter,
        reference: line.reference,
        counterpartyName: line.counterpartyName,
      })
    ),
    createdAt: new Date().toISOString(),
  };
}

export function createDemoStatements(): Record<string, BankStatementResponseDto[]> {
  const statementId = 'demo-statement-1';
  const lines = [
    createDemoLine({
      id: `${statementId}-line-0`,
      bankStatementId: statementId,
      bankAccountId: 'demo-account-1',
      clinicId: 'demo-clinic',
      transactionDate: '2026-01-15',
      description: 'Tedavi tahsilatı',
      amount: 2400,
      matchStatus: 'MATCHED',
      matchSource: 'AUTO',
      matchedRef: 'JE-2026-0042',
    }),
    createDemoLine({
      id: `${statementId}-line-1`,
      bankStatementId: statementId,
      bankAccountId: 'demo-account-1',
      clinicId: 'demo-clinic',
      transactionDate: '2026-01-16',
      description: 'Banka komisyonu',
      amount: -45.5,
      matchStatus: 'IGNORED',
      matchNote: 'Muhasebeleşmez, gider kaydı ayrı tutulur.',
    }),
    createDemoLine({
      id: `${statementId}-line-2`,
      bankStatementId: statementId,
      bankAccountId: 'demo-account-1',
      clinicId: 'demo-clinic',
      transactionDate: '2026-01-18',
      description: 'POS yatışı',
      amount: 1875.25,
      matchStatus: 'UNMATCHED',
    }),
    createDemoLine({
      id: `${statementId}-line-3`,
      bankStatementId: statementId,
      bankAccountId: 'demo-account-1',
      clinicId: 'demo-clinic',
      transactionDate: '2026-01-20',
      description: 'Kira ödemesi',
      amount: -3200,
      matchStatus: 'UNMATCHED',
    }),
  ];

  return {
    'demo-account-1': [
      {
        id: statementId,
        bankAccountId: 'demo-account-1',
        clinicId: 'demo-clinic',
        organizationId: 'demo-organization',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        openingBalance: '45000.00',
        closingBalance: '46029.75',
        fileName: 'ocak-ekstre.csv',
        importedById: 'demo-user',
        lines,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function computeDemoSummary(
  statement: BankStatementResponseDto
): ReconciliationSummaryResponseDto {
  const lines = statement.lines ?? [];
  const net = (predicate: (line: BankStatementLineResponseDto) => boolean) =>
    lines
      .filter(predicate)
      .reduce((total, line) => total + Number(line.amount), 0)
      .toFixed(2);

  return {
    bankStatementId: statement.id,
    totalLines: lines.length,
    matchedCount: lines.filter((line) => line.matchStatus === 'MATCHED').length,
    unmatchedCount: lines.filter((line) => line.matchStatus === 'UNMATCHED')
      .length,
    ignoredCount: lines.filter((line) => line.matchStatus === 'IGNORED').length,
    statementNet: net(() => true),
    matchedNet: net((line) => line.matchStatus === 'MATCHED'),
    unmatchedNet: net((line) => line.matchStatus === 'UNMATCHED'),
  };
}

export function autoMatchDemoLines(
  lines: BankStatementLineResponseDto[]
): BankStatementLineResponseDto[] {
  let matched = false;
  return lines.map((line) => {
    if (matched || line.matchStatus !== 'UNMATCHED') return line;
    matched = true;
    return {
      ...line,
      matchStatus: 'MATCHED',
      matchSource: 'AUTO',
      matchedRef: 'JE-DEMO-AUTO',
    };
  });
}

export function createDemoSuggestions(): LineMatchSuggestionResponseDto[] {
  const now = new Date().toISOString();
  return [
    {
      matchedRef: 'JE-2026-0088',
      entryId: 'demo-entry-1',
      entryNo: '0088',
      entryDate: now,
      description: 'Tedavi tahsilatı',
      amount: '1875.25',
      score: 92,
      dayDifference: 0,
      reason: 'Tutar ve tarih birebir eşleşiyor.',
      alreadyUsed: false,
    },
    {
      matchedRef: 'JE-2026-0071',
      entryId: 'demo-entry-2',
      entryNo: '0071',
      entryDate: now,
      description: 'Danışmanlık geliri',
      amount: '1875.25',
      score: 58,
      dayDifference: 3,
      reason: 'Tutar eşleşiyor, tarih farkı 3 gün.',
      alreadyUsed: false,
    },
  ];
}
