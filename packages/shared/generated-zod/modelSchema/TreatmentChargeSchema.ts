import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'

/////////////////////////////////////////
// TREATMENT CHARGE SCHEMA
/////////////////////////////////////////

/**
 * Randevuda yapılan işlemin **fiyatlı satırı**. Ticari gerçeğin tek kaydıdır:
 * ne yapıldı, liste fiyatı neydi, ne kadar indirim verildi, net ne kaldı.
 * 
 * Fiyat ve indirim satır oluşurken DONDURULUR — tedavinin liste fiyatı sonradan
 * değişse bile geçmiş satır değişmez. İndirim hastanın üstünde kalıcı bir oran
 * olarak değil, işlem anına ait bir kayıt olarak yaşar; böylece raporlanabilir,
 * denetlenebilir ve tavana tabi tutulabilir olur.
 * 
 * Fatura ve tahsilat tutarları bu satırlardan türer.
 */
export const TreatmentChargeSchema = z.object({
  currency: CurrencySchema,
  id: z.string(),
  organizationId: z.string(),
  clinicId: z.string(),
  appointmentId: z.string(),
  patientId: z.string(),
  treatmentId: z.string(),
  description: z.string().nullable(),
  quantity: decimalSchema("Field 'quantity' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  listPrice: decimalSchema("Field 'listPrice' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  discountRate: decimalSchema("Field 'discountRate' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  discountAmount: decimalSchema("Field 'discountAmount' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  discountReason: z.string().nullable(),
  netAmount: decimalSchema("Field 'netAmount' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  vatRate: z.number().int(),
  vatAmount: decimalSchema("Field 'vatAmount' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  grossAmount: decimalSchema("Field 'grossAmount' must be a Decimal. Location: ['Models', 'TreatmentCharge']"),
  discountApprovedById: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  voidedAt: z.coerce.date().nullable(),
  voidReason: z.string().nullable(),
  voidedById: z.string().nullable(),
})

export type TreatmentCharge = z.infer<typeof TreatmentChargeSchema>

export default TreatmentChargeSchema;
