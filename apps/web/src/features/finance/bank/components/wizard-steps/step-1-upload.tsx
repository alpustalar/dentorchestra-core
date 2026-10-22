import { useCallback, useEffect, useRef, useState } from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { WizardFormValues } from '@/features/finance/bank/schemas/bank-statement-import.schema';

import { CsvDataPreview } from '../csv-data-preview';
import { Field, Notice } from '../bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  control: Control<WizardFormValues>;
  fileError: string | null;
  rowsDetected: number;
  hasRows: boolean;
  previewRows: string[][];
  hasHeaderRow: boolean;
  onFileSelected: (file: File) => void;
};

export function StepUpload({
  t,
  control,
  fileError,
  rowsDetected,
  hasRows,
  previewRows,
  hasHeaderRow,
  onFileSelected,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerOpenRef = useRef(false);
  const wasFullscreenBeforePickerRef = useRef(false);
  const [showReturnToFullscreen, setShowReturnToFullscreen] = useState(false);

  const updateFullscreenReturnAction = useCallback(() => {
    if (!filePickerOpenRef.current) return;

    filePickerOpenRef.current = false;
    setShowReturnToFullscreen(
      wasFullscreenBeforePickerRef.current && !document.fullscreenElement
    );
  }, []);

  useEffect(() => {
    const fileInput = fileInputRef.current;
    const handleWindowFocus = () => {
      window.setTimeout(updateFullscreenReturnAction, 0);
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) setShowReturnToFullscreen(false);
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    fileInput?.addEventListener('cancel', updateFullscreenReturnAction);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      fileInput?.removeEventListener('cancel', updateFullscreenReturnAction);
    };
  }, [updateFullscreenReturnAction]);

  const handleFilePickerOpen = () => {
    wasFullscreenBeforePickerRef.current = Boolean(document.fullscreenElement);
    filePickerOpenRef.current = true;
    setShowReturnToFullscreen(false);
  };

  const returnToFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowReturnToFullscreen(false);
    } catch {
      // Keep the action visible so the user can retry.
    }
  }, []);

  useEffect(() => {
    if (!showReturnToFullscreen) return;

    const toastId = toast.warning(
      t('importWizard.fullscreenExitedForFilePicker'),
      {
        duration: Infinity,
        action: {
          label: t('importWizard.returnToFullscreen'),
          onClick: () => void returnToFullscreen(),
        },
      }
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [returnToFullscreen, showReturnToFullscreen, t]);

  return (
    <div className="space-y-4">
      <Field label={t('importWizard.uploadLabel')}>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onClick={handleFilePickerOpen}
          onChange={(event) => {
            updateFullscreenReturnAction();
            const file = event.target.files?.[0];
            if (file) onFileSelected(file);
          }}
          className="h-auto cursor-pointer rounded-xl border-2 border-dashed bg-muted/20 p-3 text-xs text-muted-foreground file:mr-4 file:h-10 file:cursor-pointer file:rounded-lg file:bg-primary file:px-5 file:text-sm file:font-semibold file:text-primary-foreground hover:border-primary/50 hover:bg-muted/30 hover:file:bg-primary/90"
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        {t('importWizard.uploadHint')}
      </p>
      {fileError && <Notice message={fileError} error />}
      {hasRows && !fileError && (
        <>
          <p className="text-xs text-muted-foreground">
            {t('importWizard.rowsDetected', { count: rowsDetected })}
          </p>
          <CsvDataPreview
            t={t}
            rows={previewRows}
            firstRowIsHeader={hasHeaderRow}
            variant="upload"
          />
          <Controller
            control={control}
            name="hasHeaderRow"
            render={({ field }) => (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 text-sm font-medium">
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label={t('importWizard.hasHeaderRow')}
                />
                {t('importWizard.hasHeaderRow')}
              </label>
            )}
          />
        </>
      )}
    </div>
  );
}
