'use client';

import { Button } from '@/components/ui/button';
import {
  useBankStatementImport,
  type BankStatementImportPayload,
} from '@/features/finance/bank/hooks/use-bank-statement-import';

import { StepMeta } from './wizard-steps/step-0-meta';
import { StepUpload } from './wizard-steps/step-1-upload';
import { StepMapping } from './wizard-steps/step-2-mapping';
import { StepPreview } from './wizard-steps/step-3-preview';

export type { BankStatementImportPayload };

const STEP_LABEL_KEYS = [
  'stepMeta',
  'stepUpload',
  'stepMapping',
  'stepPreview',
] as const;

export function BankStatementImportWizard({
  bankAccountId,
  isSubmitting,
  onImport,
  onComplete,
}: {
  bankAccountId: string;
  isSubmitting: boolean;
  onImport: (payload: BankStatementImportPayload) => Promise<void>;
  onComplete?: () => void;
}) {
  const wizard = useBankStatementImport({
    bankAccountId,
    onImport,
    onComplete,
  });
  const { t } = wizard;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-muted/20 px-5 py-3">
        <p className="text-sm font-medium" aria-live="polite">
          {t('importWizard.stepDescription', {
            step: wizard.step + 1,
            total: 4,
            label: t(`importWizard.${STEP_LABEL_KEYS[wizard.step]}`),
          })}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden="true">
          {STEP_LABEL_KEYS.map((key, index) => (
            <span
              key={key}
              className={
                index <= wizard.step
                  ? 'h-1 rounded-full bg-primary'
                  : 'h-1 rounded-full bg-muted'
              }
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div hidden={wizard.step !== 0} aria-hidden={wizard.step !== 0}>
          <StepMeta t={t} register={wizard.register} errors={wizard.errors} />
        </div>

        <div hidden={wizard.step !== 1} aria-hidden={wizard.step !== 1}>
          <StepUpload
            t={t}
            control={wizard.control}
            fileError={wizard.fileError}
            rowsDetected={wizard.dataRows.length}
            hasRows={wizard.hasUploadedRows}
            previewRows={wizard.rawPreviewRows}
            hasHeaderRow={wizard.formValues.hasHeaderRow}
            onFileSelected={(file) => void wizard.handleFile(file)}
          />
        </div>

        <div hidden={wizard.step !== 2} aria-hidden={wizard.step !== 2}>
          <StepMapping
            t={t}
            control={wizard.control}
            errors={wizard.errors}
            headers={wizard.headers}
            previewRows={wizard.mappedPreviewRows}
            amountModel={wizard.formValues.amountModel}
            mappingRestored={wizard.mappingRestored}
          />
        </div>

        <div hidden={wizard.step !== 3} aria-hidden={wizard.step !== 3}>
          <StepPreview
            t={t}
            builtRows={wizard.builtRows}
            errorCount={wizard.errorCount}
            totalAmount={wizard.totalAmount}
            openingBalance={wizard.openingBalance}
            closingBalance={wizard.closingBalance}
            balanceMismatch={wizard.balanceMismatch}
            submitError={wizard.submitError}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-5 py-4">
        {wizard.step > 0 ? (
          <Button type="button" variant="outline" onClick={wizard.goBack}>
            {t('importWizard.back')}
          </Button>
        ) : (
          <span />
        )}
        {wizard.step < 3 && (
          <Button
            type="button"
            onClick={() => void wizard.goNext()}
            disabled={wizard.step === 1 && !wizard.canGoNextFromUpload}
          >
            {t('importWizard.next')}
          </Button>
        )}
        {wizard.step === 3 && (
          <Button
            type="button"
            onClick={() => void wizard.submit()}
            disabled={!wizard.canSubmit || isSubmitting}
          >
            {isSubmitting ? t('importing') : t('import')}
          </Button>
        )}
      </div>
    </div>
  );
}
