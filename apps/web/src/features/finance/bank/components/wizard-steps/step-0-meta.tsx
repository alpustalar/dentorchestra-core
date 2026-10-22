import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import type { WizardFormValues } from '@/features/finance/bank/schemas/bank-statement-import.schema';

import { Field } from '../bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  register: UseFormRegister<WizardFormValues>;
  errors: FieldErrors<WizardFormValues>;
};

export function StepMeta({ t, register, errors }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('periodStart')} error={errors.periodStart}>
          <Input type="date" {...register('periodStart')} />
        </Field>
        <Field label={t('periodEnd')} error={errors.periodEnd}>
          <Input type="date" {...register('periodEnd')} />
        </Field>
        <Field label={t('openingBalance')} error={errors.openingBalanceInput}>
          <Input type="number" inputMode="decimal" step="0.01" {...register('openingBalanceInput')} />
        </Field>
        <Field label={t('closingBalance')} error={errors.closingBalanceInput}>
          <Input type="number" inputMode="decimal" step="0.01" {...register('closingBalanceInput')} />
        </Field>
        <Field label={t('fileName')} className="sm:col-span-2">
          <Input {...register('fileName')} placeholder={t('fileNamePlaceholder')} />
        </Field>
      </div>
    </div>
  );
}
