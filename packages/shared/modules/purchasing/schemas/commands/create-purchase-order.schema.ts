import { z } from 'zod';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/**
 * Satın alma siparişi oluşturma (doğrudan veya onaylı talepten).
 *
 * Ondalık sınırları **kolonlardan** gelir: `purchase_order_items.unit_price`
 * `Decimal(12,2)`, `quantity_ordered` `Decimal(12,3)`. Kapı daha genişken satır
 * tutarı sipariş yazılırken yuvarlanmamış fiyattan, okunurken (teslim değeri,
 * eşleştirme özeti) kolonun yuvarladığı fiyattan hesaplanıyordu: aynı sipariş
 * için iki farklı tutar, dolayısıyla sebebi görünmeyen bir "sipariş ↔ teslim ↔
 * fatura" sapması (CLAUDE.md finans kuralı 12 — kapı kullanım yerinden geniş olamaz).
 */
export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.uuid(),
  purchaseRequestId: z.uuid().nullable().optional(),
  expectedDate: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.uuid().nullable().optional(),
        description: z.string().min(1),
        quantity: z.number().positive().multipleOf(0.001, {
          message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
        }),
        unitPrice: z.number().nonnegative().multipleOf(0.01, {
          message: 'Birim fiyat en fazla 2 ondalık basamak taşıyabilir',
        }),
        /**
         * Kabul kümesi **kullanım yeriyle aynı** sabitten gelir. Kapı 0–100 iken
         * %8'lik bir sipariş yazılabiliyordu; o siparişin mal kabulü
         * `StockMovement` içindeki `VatRate` tarafından reddedildiği için sipariş
         * kalıcı olarak teslim alınamaz hâle geliyordu (yazılabilen ama
         * kullanılamayan veri).
         */
        vatRate: z
          .number()
          .int()
          .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
            message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
          })
          .optional(),
      })
    )
    .min(1),
  // organizationId ALINMAZ — `clinicId`'den çözülür (TENANT_SCOPE_RESOLVER).
  // Kiracı kimliği istemciden alınmaz: alan DTO'da durduğu sürece istemci
  // kontrolüne geçer ve yalnız doğrulamanın (klinik ↔ org uyuşması) tutmasına
  // bel bağlanır — oysa gönderilmesinin hiçbir meşru nedeni yok.
  clinicId: z.uuid(),
});
