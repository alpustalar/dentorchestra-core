import type { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { BankStatementResponseDto } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';
import type { AuthStatus } from '@/lib/auth';
import { formatDate } from '@/features/finance/bank/utils/bank-workspace.utils';

import { EmptyState } from './bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  hasScope: boolean;
  status: AuthStatus;
  selectedAccountId: string | null;
  selectedAccountCurrency: string | undefined;
  isLoading: boolean;
  statements: BankStatementResponseDto[];
  selectedStatementId: string | null;
  onSelectStatement: (statementId: string) => void;
  statementsPage: number;
  statementsTotalPages: number;
  onPageChange: (page: number) => void;
};

export function BankStatementsListCard({
  t,
  locale,
  hasScope,
  status,
  selectedAccountId,
  selectedAccountCurrency,
  isLoading,
  statements,
  selectedStatementId,
  onSelectStatement,
  statementsPage,
  statementsTotalPages,
  onPageChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('statementsTitle')}</CardTitle>
        <CardDescription>{t('statementsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScope ? (
          <EmptyState
            label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
          />
        ) : !selectedAccountId ? (
          <EmptyState label={t('noAccountSelected')} />
        ) : isLoading ? (
          <EmptyState label={t('loadingStatements')} />
        ) : statements.length === 0 ? (
          <EmptyState label={t('emptyStatements')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">{t('columnPeriod')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('columnLines')}</th>
                  <th className="pb-2 pr-3 text-right font-medium">
                    {t('columnOpeningBalance')}
                  </th>
                  <th className="pb-2 pr-3 text-right font-medium">
                    {t('columnClosingBalance')}
                  </th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {statements.map((statement) => (
                  <tr key={statement.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(statement.periodStart, locale)} –{' '}
                      {formatDate(statement.periodEnd, locale)}
                    </td>
                    <td className="py-2.5 pr-3">{statement.lines?.length ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {statement.openingBalance
                        ? formatAmount(statement.openingBalance, selectedAccountCurrency)
                        : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {statement.closingBalance
                        ? formatAmount(statement.closingBalance, selectedAccountCurrency)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      {statement.id === selectedStatementId ? (
                        <Badge variant="default">{t('selected')}</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectStatement(statement.id)}
                        >
                          {t('viewStatement')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasScope && selectedAccountId && statementsTotalPages > 1 && (
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('page', { page: statementsPage, totalPages: statementsTotalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, statementsPage - 1))}
                disabled={statementsPage <= 1}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onPageChange(Math.min(statementsTotalPages, statementsPage + 1))
                }
                disabled={statementsPage >= statementsTotalPages}
              >
                {t('next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
