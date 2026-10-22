import { z } from 'zod';

import { isValidSignedDecimal } from '@/features/finance/bank/utils/bank-workspace.utils';

export const DATE_FORMATS = ['DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YY'] as const;
export const DECIMAL_STYLES = ['TR', 'PLAIN', 'US'] as const;

export const wizardImportSchema = z
  .object({
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    openingBalanceInput: z
      .string()
      .refine((value) => !value.trim() || isValidSignedDecimal(value)),
    closingBalanceInput: z
      .string()
      .refine((value) => !value.trim() || isValidSignedDecimal(value)),
    fileName: z.string(),
    hasHeaderRow: z.boolean(),
    dateColumn: z.string(),
    descriptionColumn: z.string(),
    amountModel: z.enum(['SIGNED', 'DEBIT_CREDIT']),
    amountColumn: z.string(),
    invertSign: z.boolean(),
    debitColumn: z.string(),
    creditColumn: z.string(),
    balanceColumn: z.string(),
    referenceColumn: z.string(),
    counterpartyColumn: z.string(),
    dateFormat: z.enum(DATE_FORMATS),
    decimalStyle: z.enum(DECIMAL_STYLES),
  })
  .refine(
    (data) => (data.amountModel === 'SIGNED' ? Boolean(data.amountColumn) : true),
    { message: 'required', path: ['amountColumn'] }
  )
  .refine(
    (data) =>
      data.amountModel === 'DEBIT_CREDIT'
        ? Boolean(data.debitColumn) && Boolean(data.creditColumn)
        : true,
    { message: 'required', path: ['debitColumn'] }
  );

export type WizardFormValues = z.infer<typeof wizardImportSchema>;

export type SavedBankStatementMapping = Pick<
  WizardFormValues,
  | 'dateColumn'
  | 'descriptionColumn'
  | 'amountModel'
  | 'amountColumn'
  | 'invertSign'
  | 'debitColumn'
  | 'creditColumn'
  | 'balanceColumn'
  | 'referenceColumn'
  | 'counterpartyColumn'
  | 'dateFormat'
  | 'decimalStyle'
> & { headerNames: string[] };

export const MAPPING_FIELD_KEYS: Exclude<keyof SavedBankStatementMapping, 'headerNames'>[] = [
  'dateColumn',
  'descriptionColumn',
  'amountModel',
  'amountColumn',
  'invertSign',
  'debitColumn',
  'creditColumn',
  'balanceColumn',
  'referenceColumn',
  'counterpartyColumn',
  'dateFormat',
  'decimalStyle',
];

export const DEFAULT_WIZARD_VALUES: WizardFormValues = {
  periodStart: '',
  periodEnd: '',
  openingBalanceInput: '',
  closingBalanceInput: '',
  fileName: '',
  hasHeaderRow: true,
  dateColumn: '',
  descriptionColumn: '',
  amountModel: 'SIGNED',
  amountColumn: '',
  invertSign: false,
  debitColumn: '',
  creditColumn: '',
  balanceColumn: '',
  referenceColumn: '',
  counterpartyColumn: '',
  dateFormat: 'DD.MM.YYYY',
  decimalStyle: 'TR',
};
