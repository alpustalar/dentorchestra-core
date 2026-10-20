import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { PaymentMethodSchema } from '../inputTypeSchemas/PaymentMethodSchema'
import { InstallmentStatusSchema } from '../inputTypeSchemas/InstallmentStatusSchema'

/////////////////////////////////////////
// PAYMENT INSTALLMENT SCHEMA
/////////////////////////////////////////

export const PaymentInstallmentSchema = z.object({
  currency: CurrencySchema,
  method: PaymentMethodSchema,
  status: InstallmentStatusSchema,
  id: z.string(),
  paymentId: z.string(),
  installmentNo: z.number().int(),
  amount: decimalSchema("Field 'amount' must be a Decimal. Location: ['Models', 'PaymentInstallment']"),
  dueDate: z.coerce.date().nullable(),
  paidAt: z.coerce.date().nullable(),
  note: z.string().nullable(),
  /**
   * Bu taksit, ters ibrazla (chargeback) geri alınan hangi taksidin YERİNE açıldı.
   * Telafi taksiti hastadan yeniden tahsil edilecek aynı tutardır; `@unique` bir
   * taksidin yalnız bir telafisi olabileceğini DB'de sabitler (aynı itirazın
   * yeniden işlenmesi ikinci bir alacak doğurmasın).
   */
  recoversInstallmentId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PaymentInstallment = z.infer<typeof PaymentInstallmentSchema>

export default PaymentInstallmentSchema;
