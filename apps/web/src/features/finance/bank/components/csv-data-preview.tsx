import type { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  t: ReturnType<typeof useTranslations>;
  rows: string[][];
  headers?: string[];
  firstRowIsHeader?: boolean;
  variant: 'upload' | 'mapping';
};

export function CsvDataPreview({
  t,
  rows,
  headers,
  firstRowIsHeader,
  variant,
}: Props) {
  if (!rows.length) return null;

  return (
    <section className="space-y-2 rounded-lg border bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            {t(
              variant === 'upload'
                ? 'importWizard.uploadPreviewTitle'
                : 'importWizard.mappingPreviewTitle'
            )}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(
              variant === 'upload'
                ? 'importWizard.uploadPreviewHint'
                : 'importWizard.mappingPreviewHint'
            )}
          </p>
        </div>
        {variant === 'upload' && (
          <Badge variant={firstRowIsHeader ? 'secondary' : 'outline'}>
            {t(
              firstRowIsHeader
                ? 'importWizard.firstRowMarkedAsHeader'
                : 'importWizard.firstRowMarkedAsData'
            )}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full min-w-max border-collapse text-left font-mono text-xs">
          {headers && (
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="border-r px-2 py-2 font-medium">#</th>
                {headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="max-w-56 border-r px-3 py-2 font-medium last:border-r-0"
                  >
                    <span className="block truncate">{header}</span>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-t first:border-t-0',
                  variant === 'upload' &&
                    rowIndex === 0 &&
                    firstRowIsHeader &&
                    'bg-primary/5 font-semibold text-primary'
                )}
              >
                <td className="border-r px-2 py-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {variant === 'upload' && rowIndex === 0 ? (
                      <ArrowRight
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      variant === 'upload' && (
                        <span className="size-4 shrink-0" aria-hidden="true" />
                      )
                    )}
                    {rowIndex + 1}
                  </span>
                </td>
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="max-w-56 border-r px-3 py-2 last:border-r-0"
                    title={cell}
                  >
                    <span className="block truncate">{cell || '—'}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
