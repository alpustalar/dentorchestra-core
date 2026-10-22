import type { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Field } from './bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  periodStart: string;
  onPeriodStartChange: (value: string) => void;
  periodEnd: string;
  onPeriodEndChange: (value: string) => void;
  openingBalanceInput: string;
  onOpeningBalanceInputChange: (value: string) => void;
  closingBalanceInput: string;
  onClosingBalanceInputChange: (value: string) => void;
  fileName: string;
  onFileNameChange: (value: string) => void;
  linesRaw: string;
  onLinesRawChange: (value: string) => void;
  isPending: boolean;
  onSubmit: () => void;
};

export function BankLegacyPasteCard({
  t,
  periodStart,
  onPeriodStartChange,
  periodEnd,
  onPeriodEndChange,
  openingBalanceInput,
  onOpeningBalanceInputChange,
  closingBalanceInput,
  onClosingBalanceInputChange,
  fileName,
  onFileNameChange,
  linesRaw,
  onLinesRawChange,
  isPending,
  onSubmit,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('manualPasteTitle')}</CardTitle>
        <CardDescription>{t('manualPasteDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('periodStart')}>
              <Input
                type="date"
                value={periodStart}
                onChange={(event) => onPeriodStartChange(event.target.value)}
                disabled={isPending}
              />
            </Field>
            <Field label={t('periodEnd')}>
              <Input
                type="date"
                value={periodEnd}
                onChange={(event) => onPeriodEndChange(event.target.value)}
                disabled={isPending}
              />
            </Field>
            <Field label={t('openingBalance')}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={openingBalanceInput}
                onChange={(event) =>
                  onOpeningBalanceInputChange(event.target.value)
                }
                disabled={isPending}
              />
            </Field>
            <Field label={t('closingBalance')}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={closingBalanceInput}
                onChange={(event) =>
                  onClosingBalanceInputChange(event.target.value)
                }
                disabled={isPending}
              />
            </Field>
            <Field label={t('fileName')} className="sm:col-span-2">
              <Input
                value={fileName}
                onChange={(event) => onFileNameChange(event.target.value)}
                placeholder={t('fileNamePlaceholder')}
                disabled={isPending}
              />
            </Field>
          </div>
          <Field label={t('linesLabel')}>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={linesRaw}
              onChange={(event) => onLinesRawChange(event.target.value)}
              placeholder={t('linesPlaceholder')}
              disabled={isPending}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t('linesHelp')}</p>
          <Button
            type="submit"
            disabled={
              isPending ||
              !periodStart.trim() ||
              !periodEnd.trim() ||
              !linesRaw.trim()
            }
          >
            <Upload className="size-4" aria-hidden="true" />
            {isPending ? t('importing') : t('import')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
