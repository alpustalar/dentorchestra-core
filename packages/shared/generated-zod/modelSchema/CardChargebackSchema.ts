import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { SettlementProviderSchema } from '../inputTypeSchemas/SettlementProviderSchema'
import { CardChargebackSourceSchema } from '../inputTypeSchemas/CardChargebackSourceSchema'
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { CardChargebackStatusSchema } from '../inputTypeSchemas/CardChargebackStatusSchema'
import { ChargebackFundsChannelSchema } from '../inputTypeSchemas/ChargebackFundsChannelSchema'
import { CardChargebackPlanSyncSchema } from '../inputTypeSchemas/CardChargebackPlanSyncSchema'

/////////////////////////////////////////
// CARD CHARGEBACK SCHEMA
/////////////////////////////////////////

export const CardChargebackSchema = z.object({
  provider: SettlementProviderSchema,
  sourceType: CardChargebackSourceSchema,
  currency: CurrencySchema,
  status: CardChargebackStatusSchema,
  openedFundsChannel: ChargebackFundsChannelSchema,
  /**
   * Yalnız WON'da dolu: kazanılan para nereye döndü.
   */
  resolvedFundsChannel: ChargebackFundsChannelSchema.nullable(),
  /**
   * Yalnız LOST'ta dolar: ödeme planına yansıma sonucu ve açılan telafi taksidi.
   */
  planSyncStatus: CardChargebackPlanSyncSchema.nullable(),
  id: z.string(),
  organizationId: z.string(),
  clinicId: z.string(),
  /**
   * Sağlayıcının vaka numarası — kiracı+sağlayıcı içinde tekil (idempotency).
   */
  caseReference: z.string(),
  /**
   * POS_TRANSACTION → PosTransaction.id; ONLINE_PAYMENT → PaymentInstallment.id.
   */
  sourceId: z.string(),
  paymentId: z.string().nullable(),
  /**
   * Telafi taksidinin geri aldığı taksit. ONLINE'da açılışta (= sourceId);
   * POS'ta kaybedilince tutar eşleşmesiyle bulunduğunda dolar.
   */
  installmentId: z.string().nullable(),
  /**
   * Hasta ve cari: BOOKING_PAYMENT'ta NULL (platform müşterisi hasta kaydı değildir; kayıp
   * 120'ye değil 659.01'e yazılır), diğer kaynaklarda ZORUNLU — DB CHECK ile birlikte zorlanır.
   */
  patientId: z.string().nullable(),
  /**
   * Hasta carisi — kaybedilince `B 120` bu cariye yazılır; açılışta garanti edilir.
   */
  partyId: z.string().nullable(),
  /**
   * İtiraz edilen (sağlayıcının kestiği) tutar — kısmi itiraz mümkündür.
   */
  amount: decimalSchema("Field 'amount' must be a Decimal. Location: ['Models', 'CardChargeback']"),
  /**
   * Sağlayıcının itiraz başına kestiği ücret → 653. İtirazın sonucundan bağımsızdır.
   */
  feeAmount: decimalSchema("Field 'feeAmount' must be a Decimal. Location: ['Models', 'CardChargeback']"),
  /**
   * Paranın kesildiği gün — açılış fişinin belge tarihi (dönem kapısı buna bakar).
   */
  openedAt: z.coerce.date(),
  openedBankAccountId: z.string().nullable(),
  /**
   * Delil sunma son günü. Yalnız saklanır; delil iş akışı bu modülün işi değil.
   */
  evidenceDueAt: z.coerce.date().nullable(),
  note: z.string().nullable(),
  /**
   * Sonucun belli olduğu gün — çözüm fişinin belge tarihi.
   */
  resolvedAt: z.coerce.date().nullable(),
  resolvedBankAccountId: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  /**
   * Muhasebe köprüsü izi — mükerrer fiş ve yarıda kalma koruması.
   */
  openedEventId: z.string().nullable(),
  resolvedEventId: z.string().nullable(),
  recoveryInstallmentId: z.string().nullable(),
  /**
   * Yüksek etkili finansal işlem: kalıcı damga (kim kaydetti / kim sonuçlandırdı).
   */
  recordedById: z.string(),
  resolvedById: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CardChargeback = z.infer<typeof CardChargebackSchema>

export default CardChargebackSchema;
