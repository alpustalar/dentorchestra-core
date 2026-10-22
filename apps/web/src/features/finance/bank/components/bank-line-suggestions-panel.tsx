import type { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import type {
  BankStatementLineResponseDto,
  LineMatchSuggestionResponseDto,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';
import { formatDate } from '@/features/finance/bank/utils/bank-workspace.utils';

import { EmptyState } from './bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  selectedLine: BankStatementLineResponseDto;
  isLoading: boolean;
  suggestions: LineMatchSuggestionResponseDto[];
  selectedAccountCurrency: string | undefined;
  reconcilePending: boolean;
  onClose: () => void;
  onUseSuggestion: (matchedRef: string) => void;
};

export function BankLineSuggestionsPanel({
  t,
  locale,
  selectedLine,
  isLoading,
  suggestions,
  selectedAccountCurrency,
  reconcilePending,
  onClose,
  onUseSuggestion,
}: Props) {
  return (
    <section className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{t('suggestionsTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('suggestionsDescription', { description: selectedLine.description })}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
          {t('closeSuggestions')}
        </Button>
      </div>

      {isLoading ? (
        <EmptyState label={t('loadingSuggestions')} />
      ) : suggestions.length === 0 ? (
        <EmptyState label={t('noSuggestions')} />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">{t('columnEntryNo')}</th>
                <th className="pb-2 pr-3 font-medium">{t('columnEntryDate')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('columnAmount')}</th>
                <th className="pb-2 pr-3 text-right font-medium">{t('columnScore')}</th>
                <th className="pb-2 pr-3 font-medium">{t('columnReason')}</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.entryId} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {suggestion.entryNo ?? '—'}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(suggestion.entryDate, locale)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatAmount(suggestion.amount, selectedAccountCurrency)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {suggestion.score}
                  </td>
                  <td className="py-2.5 pr-3 max-w-56 truncate text-xs text-muted-foreground">
                    {suggestion.reason}
                  </td>
                  <td className="py-2.5 text-right">
                    {suggestion.alreadyUsed ? (
                      <Badge variant="outline">{t('alreadyUsed')}</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={reconcilePending}
                        onClick={() => onUseSuggestion(suggestion.matchedRef)}
                      >
                        {t('useSuggestion')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
