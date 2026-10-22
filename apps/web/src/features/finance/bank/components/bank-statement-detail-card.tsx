import type { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import type {
  BankStatementLineResponseDto,
  LineMatchSuggestionResponseDto,
  ReconciliationSummaryResponseDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AuthStatus } from '@/lib/auth';

import { EmptyState, Field, Metric } from './bank-ui-primitives';
import { BankStatementLinesTable } from './bank-statement-lines-table';
import { BankLineSuggestionsPanel } from './bank-line-suggestions-panel';
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';

type Props = {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  hasScope: boolean;
  status: AuthStatus;
  selectedStatementId: string | null;
  isLoadingStatement: boolean;
  summary: ReconciliationSummaryResponseDto | null;
  selectedAccountCurrency: string | undefined;
  canReconcileLine: boolean;
  dateToleranceDays: string;
  onDateToleranceDaysChange: (value: string) => void;
  autoMatchPending: boolean;
  onRunAutoMatch: () => void;
  lines: BankStatementLineResponseDto[];
  reconcilePending: boolean;
  onViewSuggestions: (lineId: string) => void;
  onIgnoreLine: (lineId: string) => void;
  onRevertLine: (lineId: string) => void;
  selectedLine: BankStatementLineResponseDto | null;
  suggestionsLoading: boolean;
  suggestions: LineMatchSuggestionResponseDto[];
  onCloseSuggestions: () => void;
  onUseSuggestion: (matchedRef: string) => void;
};

export function BankStatementDetailCard({
  t,
  locale,
  hasScope,
  status,
  selectedStatementId,
  isLoadingStatement,
  summary,
  selectedAccountCurrency,
  canReconcileLine,
  dateToleranceDays,
  onDateToleranceDaysChange,
  autoMatchPending,
  onRunAutoMatch,
  lines,
  reconcilePending,
  onViewSuggestions,
  onIgnoreLine,
  onRevertLine,
  selectedLine,
  suggestionsLoading,
  suggestions,
  onCloseSuggestions,
  onUseSuggestion,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('statementTitle')}</CardTitle>
        <CardDescription>{t('statementDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasScope ? (
          <EmptyState
            label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
          />
        ) : !selectedStatementId ? (
          <EmptyState label={t('noStatementSelected')} />
        ) : isLoadingStatement ? (
          <EmptyState label={t('loadingStatement')} />
        ) : (
          <>
            {summary && (
              <section>
                <h3 className="mb-3 font-semibold">{t('summaryTitle')}</h3>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Metric label={t('totalLines')} value={String(summary.totalLines)} />
                  <Metric
                    label={t('matchedCount')}
                    value={String(summary.matchedCount)}
                  />
                  <Metric
                    label={t('unmatchedCount')}
                    value={String(summary.unmatchedCount)}
                  />
                  <Metric
                    label={t('ignoredCount')}
                    value={String(summary.ignoredCount)}
                  />
                  <Metric
                    label={t('statementNet')}
                    value={`${formatAmount(summary.statementNet, selectedAccountCurrency)}`}
                  />
                  <Metric
                    label={t('unmatchedNet')}
                    value={`${formatAmount(summary.unmatchedNet, selectedAccountCurrency)}`}
                  />
                </dl>
              </section>
            )}

            {canReconcileLine && (
              <section className="rounded-lg border p-4">
                <h3 className="mb-1 font-semibold">{t('autoMatchTitle')}</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  {t('autoMatchDescription')}
                </p>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRunAutoMatch();
                  }}
                >
                  <Field label={t('dateTolerance')}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="15"
                      step="1"
                      value={dateToleranceDays}
                      onChange={(event) => onDateToleranceDaysChange(event.target.value)}
                      disabled={autoMatchPending}
                    />
                  </Field>
                  <Button type="submit" disabled={autoMatchPending}>
                    <Sparkles className="size-4" aria-hidden="true" />
                    {autoMatchPending ? t('runningAutoMatch') : t('runAutoMatch')}
                  </Button>
                </form>
              </section>
            )}

            <section>
              <h3 className="mb-3 font-semibold">{t('linesTitle')}</h3>
              <BankStatementLinesTable
                t={t}
                locale={locale}
                lines={lines}
                selectedAccountCurrency={selectedAccountCurrency}
                canReconcileLine={canReconcileLine}
                reconcilePending={reconcilePending}
                onViewSuggestions={onViewSuggestions}
                onIgnoreLine={onIgnoreLine}
                onRevertLine={onRevertLine}
              />
            </section>

            {selectedLine && (
              <BankLineSuggestionsPanel
                t={t}
                locale={locale}
                selectedLine={selectedLine}
                isLoading={suggestionsLoading}
                suggestions={suggestions}
                selectedAccountCurrency={selectedAccountCurrency}
                reconcilePending={reconcilePending}
                onClose={onCloseSuggestions}
                onUseSuggestion={onUseSuggestion}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
