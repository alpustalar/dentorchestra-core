'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Papa from 'papaparse';
import { useTranslations } from 'next-intl';

import type { ImportBankStatementDtoLinesItem } from '@/api/generated/model';
import { roundMoney } from '@/features/finance/shared/utils/money-formatter.util';
import {
  DEFAULT_WIZARD_VALUES,
  MAPPING_FIELD_KEYS,
  wizardImportSchema,
  type SavedBankStatementMapping,
  type WizardFormValues,
} from '@/features/finance/bank/schemas/bank-statement-import.schema';
import {
  buildStatementLines,
  type BuiltStatementRow,
} from '@/features/finance/bank/utils/bank-statement-parser.util';
import {
  loadSavedStatementMapping,
  saveStatementMapping,
} from '@/features/finance/bank/utils/bank-statement-mapping-storage.util';

export type BankStatementImportPayload = {
  periodStart: string;
  periodEnd: string;
  openingBalance?: number;
  closingBalance?: number;
  fileName?: string;
  lines: ImportBankStatementDtoLinesItem[];
};

type UseBankStatementImportInput = {
  bankAccountId: string;
  onImport: (payload: BankStatementImportPayload) => Promise<void>;
  onComplete?: () => void;
};

export function useBankStatementImport({
  bankAccountId,
  onImport,
  onComplete,
}: UseBankStatementImportInput) {
  const t = useTranslations('FinanceBank');

  const [step, setStep] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [mappingRestored, setMappingRestored] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    register,
    watch,
    trigger,
    setValue,
    reset: resetForm,
    handleSubmit,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardImportSchema),
    defaultValues: DEFAULT_WIZARD_VALUES,
    mode: 'onChange',
    shouldUnregister: false,
  });

  const formValues = watch();

  const reset = () => {
    setStep(0);
    resetForm(DEFAULT_WIZARD_VALUES);
    setFileError(null);
    setAllRows([]);
    setMappingRestored(false);
    setSubmitError(null);
  };

  const headers = useMemo(() => {
    if (allRows.length === 0) return [];
    const first = allRows[0];
    return formValues.hasHeaderRow
      ? first
      : first.map(
          (_, columnIndex) =>
            `${t('importWizard.columnFallback')} ${columnIndex + 1}`
        );
  }, [allRows, formValues.hasHeaderRow, t]);

  const dataRows = useMemo(
    () => (formValues.hasHeaderRow ? allRows.slice(1) : allRows),
    [allRows, formValues.hasHeaderRow]
  );

  const handleFile = async (file: File) => {
    setFileError(null);
    setValue('dateColumn', '');
    setValue('descriptionColumn', '');
    setValue('amountColumn', '');
    setValue('debitColumn', '');
    setValue('creditColumn', '');
    setValue('balanceColumn', '');
    setValue('referenceColumn', '');
    setValue('counterpartyColumn', '');
    setMappingRestored(false);
    if (!formValues.fileName.trim()) setValue('fileName', file.name);

    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    if (result.errors.length > 0 && result.data.length === 0) {
      setFileError(t('importWizard.fileParseError'));
      setAllRows([]);
      return;
    }
    if (result.data.length === 0) {
      setFileError(t('importWizard.emptyFileError'));
      setAllRows([]);
      return;
    }
    setAllRows(result.data);
  };

  const applyHeaders = (nextHeaders: string[]) => {
    const saved = loadSavedStatementMapping(bankAccountId, nextHeaders);
    if (saved) {
      MAPPING_FIELD_KEYS.forEach((key) => setValue(key, saved[key] as never));
      setMappingRestored(true);
    } else {
      setMappingRestored(false);
    }
  };

  const messages = useMemo(
    () => ({
      missingDate: t('importWizard.rowErrorMissingDate'),
      missingDescription: t('importWizard.rowErrorMissingDescription'),
      invalidDate: t('importWizard.rowErrorInvalidDate', {
        format: formValues.dateFormat,
      }),
      invalidAmount: t('importWizard.rowErrorInvalidAmount'),
      invalidBalance: t('importWizard.rowErrorInvalidBalance'),
    }),
    [t, formValues.dateFormat]
  );

  const builtRows = useMemo(
    () => buildStatementLines({ dataRows, mapping: formValues, messages }),
    [dataRows, formValues, messages]
  );

  const errorCount = builtRows.filter((row) => row.error).length;
  const lines = builtRows
    .filter(
      (
        row
      ): row is BuiltStatementRow & { line: ImportBankStatementDtoLinesItem } =>
        Boolean(row.line)
    )
    .map((row) => row.line);
  const totalAmount = roundMoney(
    lines.reduce((sum, line) => sum + line.amount, 0)
  );

  const openingBalance = formValues.openingBalanceInput.trim()
    ? Number(formValues.openingBalanceInput)
    : undefined;
  const closingBalance = formValues.closingBalanceInput.trim()
    ? Number(formValues.closingBalanceInput)
    : undefined;
  const balanceMismatch =
    openingBalance !== undefined && closingBalance !== undefined
      ? roundMoney(openingBalance + totalAmount) !== roundMoney(closingBalance)
      : false;

  const canGoNextFromUpload =
    allRows.length > 0 && dataRows.length > 0 && !fileError;
  const canSubmit = lines.length > 0 && errorCount === 0;

  const goNext = async () => {
    if (step === 0) {
      const valid = await trigger([
        'periodStart',
        'periodEnd',
        'openingBalanceInput',
        'closingBalanceInput',
      ]);
      if (valid) setStep(1);
      return;
    }
    if (step === 1) {
      if (!canGoNextFromUpload) return;
      applyHeaders(headers);
      setStep(2);
      return;
    }
    if (step === 2) {
      const valid = await trigger([
        'dateColumn',
        'descriptionColumn',
        'amountColumn',
        'debitColumn',
        'creditColumn',
      ]);
      if (valid) setStep(3);
    }
  };

  const goBack = () => setStep((currentStep) => Math.max(0, currentStep - 1));

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onImport({
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        ...(openingBalance !== undefined ? { openingBalance } : {}),
        ...(closingBalance !== undefined ? { closingBalance } : {}),
        ...(values.fileName.trim() ? { fileName: values.fileName.trim() } : {}),
        lines,
      });
      const mapping: SavedBankStatementMapping = {
        headerNames: headers,
        ...MAPPING_FIELD_KEYS.reduce(
          (acc, key) => ({ ...acc, [key]: values[key] }),
          {} as Omit<SavedBankStatementMapping, 'headerNames'>
        ),
      };
      saveStatementMapping(bankAccountId, mapping);
      reset();
      onComplete?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('importError'));
    }
  });

  return {
    t,
    step,
    reset,
    goNext,
    goBack,
    submit,
    control,
    register,
    errors,
    formValues,
    headers,
    dataRows,
    rawPreviewRows: allRows.slice(0, 4),
    mappedPreviewRows: dataRows.slice(0, 4),
    hasUploadedRows: allRows.length > 0,
    fileError,
    handleFile,
    mappingRestored,
    builtRows,
    errorCount,
    totalAmount,
    openingBalance,
    closingBalance,
    balanceMismatch,
    canGoNextFromUpload,
    canSubmit,
    submitError,
  };
}
