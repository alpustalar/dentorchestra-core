import type { useTranslations } from 'next-intl';

import type { BankStatementLineResponseDto } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';
import { formatDate } from '@/features/finance/bank/utils/bank-workspace.utils';

import { EmptyState } from './bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  lines: BankStatementLineResponseDto[];
  selectedAccountCurrency: string | undefined;
  canReconcileLine: boolean;
  reconcilePending: boolean;
  onViewSuggestions: (lineId: string) => void;
  onIgnoreLine: (lineId: string) => void;
  onRevertLine: (lineId: string) => void;
};

export function BankStatementLinesTable({
  t,
  locale,
  lines,
  selectedAccountCurrency,
  canReconcileLine,
  reconcilePending,
  onViewSuggestions,
  onIgnoreLine,
  onRevertLine,
}: Props) {
  if (lines.length === 0) return <EmptyState label={t('noLines')} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-190 text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 pr-3 font-medium">{t('columnDate')}</th>
            <th className="pb-2 pr-3 font-medium">{t('columnDescription')}</th>
            <th className="pb-2 pr-3 text-right font-medium">{t('columnAmount')}</th>
            <th className="pb-2 pr-3 font-medium">{t('columnMatchStatus')}</th>
            <th className="pb-2 pr-3 font-medium">{t('columnMatchSource')}</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                {formatDate(line.transactionDate, locale)}
              </td>
              <td className="py-2.5 pr-3 max-w-56 truncate">{line.description}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {formatAmount(line.amount, selectedAccountCurrency)}
              </td>
              <td className="py-2.5 pr-3">
                <Badge
                  variant={
                    line.matchStatus === 'MATCHED'
                      ? 'secondary'
                      : line.matchStatus === 'IGNORED'
                        ? 'outline'
                        : 'destructive'
                  }
                >
                  {t(`matchStatus.${line.matchStatus}`)}
                </Badge>
              </td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                {t(`matchSource.${line.matchSource}`)}
              </td>
              <td className="py-2.5 text-right">
                {canReconcileLine && (
                  <div className="flex justify-end gap-1.5">
                    {line.matchStatus === 'UNMATCHED' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onViewSuggestions(line.id)}
                        >
                          {t('viewSuggestions')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={reconcilePending}
                          onClick={() => onIgnoreLine(line.id)}
                        >
                          {t('ignoreLine')}
                        </Button>
                      </>
                    )}
                    {line.matchStatus !== 'UNMATCHED' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={reconcilePending}
                        onClick={() => onRevertLine(line.id)}
                      >
                        {t('revertLine')}
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
