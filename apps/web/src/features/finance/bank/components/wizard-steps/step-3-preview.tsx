import type { useTranslations } from 'next-intl';

import { formatAmount, roundMoney } from '@/features/finance/shared/utils/money-formatter.util';
import type { BuiltStatementRow } from '@/features/finance/bank/utils/bank-statement-parser.util';
import { cn } from '@/lib/utils';

import { Notice } from '../bank-ui-primitives';

const PREVIEW_ROW_LIMIT = 15;

type Props = {
  t: ReturnType<typeof useTranslations>;
  builtRows: BuiltStatementRow[];
  errorCount: number;
  totalAmount: number;
  openingBalance: number | undefined;
  closingBalance: number | undefined;
  balanceMismatch: boolean;
  submitError: string | null;
};

export function StepPreview({
  t,
  builtRows,
  errorCount,
  totalAmount,
  openingBalance,
  closingBalance,
  balanceMismatch,
  submitError,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3 text-sm">
        <span>
          {t('importWizard.previewSummary', { total: builtRows.length, errorCount })}
        </span>
        <span className="font-medium tabular-nums">
          {t('importWizard.previewTotalAmount')}: {formatAmount(totalAmount)}
        </span>
      </div>

      {openingBalance !== undefined && closingBalance !== undefined && (
        <Notice
          error={balanceMismatch}
          message={
            balanceMismatch
              ? t('importWizard.previewBalanceMismatch', {
                  expected: formatAmount(roundMoney(openingBalance + totalAmount)) ?? '',
                  actual: formatAmount(closingBalance) ?? '',
                })
              : t('importWizard.previewBalanceOk')
          }
        />
      )}

      {errorCount > 0 && <Notice error message={t('importWizard.fixErrorsFirst')} />}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-130 text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">{t('importWizard.previewColumnRow')}</th>
              <th className="px-2 py-2 font-medium">{t('importWizard.previewColumnDate')}</th>
              <th className="px-2 py-2 font-medium">
                {t('importWizard.previewColumnDescription')}
              </th>
              <th className="px-2 py-2 text-right font-medium">
                {t('importWizard.previewColumnAmount')}
              </th>
              <th className="px-2 py-2 font-medium">{t('importWizard.previewColumnError')}</th>
            </tr>
          </thead>
          <tbody>
            {builtRows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
              <tr
                key={row.index}
                className={cn('border-b last:border-0', row.error && 'bg-destructive/5')}
              >
                <td className="px-2 py-2 text-xs text-muted-foreground">{row.index + 1}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {row.line?.transactionDate ?? '—'}
                </td>
                <td className="max-w-56 truncate px-2 py-2">{row.line?.description ?? '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.line ? formatAmount(row.line.amount) : '—'}
                </td>
                <td className="px-2 py-2 text-xs text-destructive">{row.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {builtRows.length > PREVIEW_ROW_LIMIT && (
        <p className="text-xs text-muted-foreground">
          {t('importWizard.previewMoreRows', { count: builtRows.length - PREVIEW_ROW_LIMIT })}
        </p>
      )}

      {submitError && <Notice error message={submitError} />}
    </div>
  );
}
