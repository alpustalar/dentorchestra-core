import { z } from 'zod';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/** Para birimi — @prisma/client'a bağlanmadan (frontend güvenliği) lokal enum. */
export const PurchaseInvoiceCurrencyEnum = z.enum(['TRY', 'USD', 'EUR', 'GBP']);

/**
 * Tedarikçiden alınan alış faturasını kaydeder. net + KDV tedarikçinin belgesinde
 * basılıdır; ikisi de açıkça alınır, grandTotal = net + vat hesaplanır.
 * Tedarikçi kimliği snapshot olarak taşınır (inventory modülü cross-module sorguya
 * bağlı değil) → finans carisi (320) bu bilgilerle garanti edilir.
 */
export const RecordPurchaseInvoiceSchema = z.object({
  supplierId: z.uuid(),
  supplierName: z.string().min(1),
  supplierTaxNumber: z.string().optional(),
  supplierTaxOffice: z.string().optional(),

  invoiceNumber: z.string().optional(),
  invoiceDate: z.coerce.date(),

  /**
   * Faturanın eşleştirileceği satın alma siparişi (opsiyonel). Verilirse sipariş
   * kilit altında doğrulanır (tedarikçi/klinik/para birimi uyumu + faturalanan
   * toplam sipariş tutarını aşamaz) ve siparişin faturalama durumu güncellenir.
   */
  purchaseOrderId: z.uuid().optional(),

  /** Karşı borç/gider hesabı: 150 (stok) | 770/760/740 (gider). */
  lineAccountCode: z.string().min(1).default('770'),
  /**
   * Kabul kümesi **kullanım yeriyle aynı** sabitten gelir: entity oranı
   * `VatRate` VO'suna sokuyor ve yasal olmayan oranı reddediyor. Kapı 0–100
   * kaldığı sürece kullanıcı %8 gönderip "Yasal olmayan KDV oranı" hatasını
   * oranın yanında değil, kaydın ortasında görüyordu (CLAUDE.md finans kuralı 12).
   */
  vatRate: z
    .number()
    .int()
    .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
    }),

  /**
   * Tutarlar kuruş hassasiyetindedir (en fazla 2 ondalık): kolonlar
   * `Decimal(12,2)` ve kuruş altı girdi DB'de sessizce yuvarlanıp "net + KDV =
   * genel toplam" dengesini satırda bozuyor (fiş dengesiz kalır, muhasebeleşemez).
   * Aynı kural entity'de de zorlanır — bu kapı ondan geniş olamaz.
   */
  netTotal: z.number().nonnegative().multipleOf(0.01),
  vatTotal: z.number().nonnegative().multipleOf(0.01),
  currency: PurchaseInvoiceCurrencyEnum.default('TRY'),

  // organizationId ALINMAZ — clinicId'den türetilir (bkz. create-supplier).
  clinicId: z.uuid(),
});
