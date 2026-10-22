import type { ImportBankStatementDtoLinesItem } from '@/api/generated/model';

export function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export function isValidName(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidSignedDecimal(value: string): boolean {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) return false;
  return Number.isFinite(Number(value));
}

export function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value)
  );
}

/**
 * Her satır: tarih,açıklama,tutar[,bakiye,referans,karşı taraf]. Basit CSV —
 * alanlarda virgül kaçışı desteklenmez (bkz. linesHelp metni).
 */
export function parseStatementLines(
  raw: string
): ImportBankStatementDtoLinesItem[] | null {
  const rows = raw
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  if (rows.length === 0) return null;

  const lines: ImportBankStatementDtoLinesItem[] = [];
  for (const row of rows) {
    const columns = row.split(',').map((column) => column.trim());
    const [transactionDate, description, amountRaw, balanceAfterRaw, reference, counterpartyName] =
      columns;
    if (!transactionDate || !description || !amountRaw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) return null;
    if (!isValidSignedDecimal(amountRaw)) return null;
    if (balanceAfterRaw && !isValidSignedDecimal(balanceAfterRaw)) return null;

    lines.push({
      transactionDate,
      description,
      amount: Number(amountRaw),
      ...(balanceAfterRaw ? { balanceAfter: Number(balanceAfterRaw) } : {}),
      ...(reference ? { reference } : {}),
      ...(counterpartyName ? { counterpartyName } : {}),
    });
  }
  return lines;
}
