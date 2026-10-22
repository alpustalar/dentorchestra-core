import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import type { ImportBankStatementDtoLinesItem } from '@/api/generated/model';
import { roundMoney } from '@/features/finance/shared/utils/money-formatter.util';
import type { WizardFormValues } from '@/features/finance/bank/schemas/bank-statement-import.schema';

dayjs.extend(customParseFormat);

export type BuiltStatementRow = {
  index: number;
  cells: string[];
  line: ImportBankStatementDtoLinesItem | null;
  error: string | null;
};

type BuildStatementLinesMessages = {
  missingDate: string;
  missingDescription: string;
  invalidDate: string;
  invalidAmount: string;
  invalidBalance: string;
};

function normalizeDecimal(raw: string, style: WizardFormValues['decimalStyle']): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  let normalized = trimmed;
  if (style === 'TR') normalized = normalized.replace(/\./g, '').replace(',', '.');
  else if (style === 'US') normalized = normalized.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseStatementRowDate(
  raw: string,
  format: WizardFormValues['dateFormat']
): string | null {
  const parsed = dayjs(raw.trim(), format, true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}

export function buildStatementLines({
  dataRows,
  mapping,
  messages,
}: {
  dataRows: string[][];
  mapping: WizardFormValues;
  messages: BuildStatementLinesMessages;
}): BuiltStatementRow[] {
  const cell = (row: string[], columnIndex: string): string =>
    columnIndex === '' ? '' : (row[Number(columnIndex)] ?? '').trim();

  return dataRows.map((row, index) => {
    const rawDate = cell(row, mapping.dateColumn);
    const description = cell(row, mapping.descriptionColumn);

    if (!rawDate) return { index, cells: row, line: null, error: messages.missingDate };
    if (!description)
      return { index, cells: row, line: null, error: messages.missingDescription };

    const transactionDate = parseStatementRowDate(rawDate, mapping.dateFormat);
    if (!transactionDate)
      return { index, cells: row, line: null, error: messages.invalidDate };

    let amount: number | null;
    if (mapping.amountModel === 'SIGNED') {
      const parsed = normalizeDecimal(cell(row, mapping.amountColumn), mapping.decimalStyle);
      amount = parsed === null ? null : mapping.invertSign ? -parsed : parsed;
    } else {
      const debit = normalizeDecimal(cell(row, mapping.debitColumn), mapping.decimalStyle);
      const credit = normalizeDecimal(cell(row, mapping.creditColumn), mapping.decimalStyle);
      amount = debit === null || credit === null ? null : credit - debit;
    }
    if (amount === null || !Number.isFinite(amount))
      return { index, cells: row, line: null, error: messages.invalidAmount };

    const rawBalance = cell(row, mapping.balanceColumn);
    let balanceAfter: number | undefined;
    if (rawBalance) {
      const parsedBalance = normalizeDecimal(rawBalance, mapping.decimalStyle);
      if (parsedBalance === null)
        return { index, cells: row, line: null, error: messages.invalidBalance };
      balanceAfter = parsedBalance;
    }

    const reference = cell(row, mapping.referenceColumn) || undefined;
    const counterpartyName = cell(row, mapping.counterpartyColumn) || undefined;

    return {
      index,
      cells: row,
      error: null,
      line: {
        transactionDate,
        description,
        amount: roundMoney(amount),
        ...(balanceAfter !== undefined ? { balanceAfter } : {}),
        ...(reference ? { reference } : {}),
        ...(counterpartyName ? { counterpartyName } : {}),
      },
    };
  });
}
