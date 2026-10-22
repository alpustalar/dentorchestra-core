import { SelectInput } from '@/components/ui/select-input';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller, useController } from 'react-hook-form';
import type { useTranslations } from 'next-intl';

import {
  DATE_FORMATS,
  type WizardFormValues,
} from '@/features/finance/bank/schemas/bank-statement-import.schema';
import { cn } from '@/lib/utils';

import { CsvDataPreview } from '../csv-data-preview';
import { Field, Notice } from '../bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  control: Control<WizardFormValues>;
  errors: FieldErrors<WizardFormValues>;
  headers: string[];
  previewRows: string[][];
  amountModel: WizardFormValues['amountModel'];
  mappingRestored: boolean;
};

type SelectFieldName =
  | 'dateColumn'
  | 'descriptionColumn'
  | 'dateFormat'
  | 'decimalStyle'
  | 'amountColumn'
  | 'debitColumn'
  | 'creditColumn'
  | 'balanceColumn'
  | 'referenceColumn'
  | 'counterpartyColumn';

function WizardSelect({
  control,
  name,
  children,
}: {
  control: Control<WizardFormValues>;
  name: SelectFieldName;
  children: ReactNode;
}) {
  const { field } = useController({ control, name });

  return (
    <SelectInput
      className="h-9 w-full"
      value={String(field.value)}
      name={field.name}
      ref={field.ref}
      onBlur={field.onBlur}
      onChange={(event) => field.onChange(event.target.value)}
    >
      {children}
    </SelectInput>
  );
}

export function StepMapping({
  t,
  control,
  errors,
  headers,
  previewRows,
  amountModel,
  mappingRestored,
}: Props) {
  const columnOptions = (
    <>
      <option value="">{t('importWizard.selectColumnPlaceholder')}</option>
      {headers.map((header, columnIndex) => (
        <option key={columnIndex} value={String(columnIndex)}>
          {header}
        </option>
      ))}
    </>
  );

  const optionalColumnOptions = (
    <>
      <option value="">{t('importWizard.noneOption')}</option>
      {headers.map((header, columnIndex) => (
        <option key={columnIndex} value={String(columnIndex)}>
          {header}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      {mappingRestored && (
        <Notice message={t('importWizard.mappingRestoredNotice')} />
      )}

      <CsvDataPreview
        t={t}
        headers={headers}
        rows={previewRows}
        variant="mapping"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('importWizard.mappingDateColumn')}
          error={errors.dateColumn}
        >
          <WizardSelect control={control} name="dateColumn">
            {columnOptions}
          </WizardSelect>
        </Field>
        <Field
          label={t('importWizard.mappingDescriptionColumn')}
          error={errors.descriptionColumn}
        >
          <WizardSelect control={control} name="descriptionColumn">
            {columnOptions}
          </WizardSelect>
        </Field>
        <Field label={t('importWizard.mappingDateFormat')}>
          <WizardSelect control={control} name="dateFormat">
            {DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </WizardSelect>
        </Field>
        <Field label={t('importWizard.mappingDecimalStyle')}>
          <WizardSelect control={control} name="decimalStyle">
            <option value="TR">{t('importWizard.decimalStyleTr')}</option>
            <option value="PLAIN">{t('importWizard.decimalStylePlain')}</option>
            <option value="US">{t('importWizard.decimalStyleUs')}</option>
          </WizardSelect>
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t('importWizard.mappingAmountModel')}
        </p>
        <Controller
          control={control}
          name="amountModel"
          render={({ field }) => (
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  field.value === 'SIGNED'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input'
                )}
                onClick={() => field.onChange('SIGNED')}
              >
                {t('importWizard.amountModelSigned')}
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  field.value === 'DEBIT_CREDIT'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input'
                )}
                onClick={() => field.onChange('DEBIT_CREDIT')}
              >
                {t('importWizard.amountModelDebitCredit')}
              </button>
            </div>
          )}
        />

        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs font-medium">
            {amountModel === 'SIGNED'
              ? t('importWizard.amountModelSignedNoteTitle')
              : t('importWizard.amountModelDebitCreditNoteTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {amountModel === 'SIGNED'
              ? t('importWizard.amountModelSignedNote')
              : t('importWizard.amountModelDebitCreditNote')}
          </p>
        </div>

        {amountModel === 'SIGNED' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('importWizard.mappingAmountColumn')}
              error={errors.amountColumn}
            >
              <WizardSelect control={control} name="amountColumn">
                {columnOptions}
              </WizardSelect>
            </Field>
            <Controller
              control={control}
              name="invertSign"
              render={({ field }) => (
                <div className="flex min-h-11 items-center gap-2 self-end rounded-lg border bg-background px-3 text-sm">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label={t('importWizard.mappingInvertSign')}
                  />
                  <span className="font-medium">
                    {t('importWizard.mappingInvertSign')}
                  </span>
                  <TooltipProvider delay={250}>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        aria-label={t('importWizard.invertSignInfoLabel')}
                        className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Info className="size-4" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t('importWizard.invertSignInfo')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('importWizard.mappingDebitColumn')}
              error={errors.debitColumn}
            >
              <WizardSelect control={control} name="debitColumn">
                {columnOptions}
              </WizardSelect>
            </Field>
            <Field label={t('importWizard.mappingCreditColumn')}>
              <WizardSelect control={control} name="creditColumn">
                {columnOptions}
              </WizardSelect>
            </Field>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('importWizard.mappingBalanceColumn')}>
          <WizardSelect control={control} name="balanceColumn">
            {optionalColumnOptions}
          </WizardSelect>
        </Field>
        <Field label={t('importWizard.mappingReferenceColumn')}>
          <WizardSelect control={control} name="referenceColumn">
            {optionalColumnOptions}
          </WizardSelect>
        </Field>
        <Field label={t('importWizard.mappingCounterpartyColumn')}>
          <WizardSelect control={control} name="counterpartyColumn">
            {optionalColumnOptions}
          </WizardSelect>
        </Field>
      </div>
    </div>
  );
}
