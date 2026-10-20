import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { RoundingDirectionSchema } from '../inputTypeSchemas/RoundingDirectionSchema'
import { BusinessTypeSchema } from '../inputTypeSchemas/BusinessTypeSchema'
import { PayoutTriggerSchema } from '../inputTypeSchemas/PayoutTriggerSchema'

/////////////////////////////////////////
// CLINIC FINANCE SETTINGS SCHEMA
/////////////////////////////////////////

export const ClinicFinanceSettingsSchema = z.object({
  defaultCurrency: CurrencySchema,
  roundingType: RoundingDirectionSchema,
  businessType: BusinessTypeSchema.nullable(),
  providerPayoutTrigger: PayoutTriggerSchema,
  id: z.string(),
  clinicId: z.string(),
  invoicePrefix: z.string(),
  autoCreateInvoice: z.boolean(),
  autoSendDebtReminder: z.boolean(),
  defaultVatRate: decimalSchema("Field 'defaultVatRate' must be a Decimal. Location: ['Models', 'ClinicFinanceSettings']"),
  useCostTracking: z.boolean(),
  allowNegativeBalance: z.boolean(),
  maxNegativeBalanceAmount: decimalSchema("Field 'maxNegativeBalanceAmount' must be a Decimal. Location: ['Models', 'ClinicFinanceSettings']"),
  maxInstallmentCount: z.number().int(),
  maxDiscountPercent: decimalSchema("Field 'maxDiscountPercent' must be a Decimal. Location: ['Models', 'ClinicFinanceSettings']"),
  isEInvoiceActive: z.boolean(),
  fiscalYearStartMonth: z.number().int(),
  updatedAt: z.coerce.date(),
})

export type ClinicFinanceSettings = z.infer<typeof ClinicFinanceSettingsSchema>

export default ClinicFinanceSettingsSchema;
