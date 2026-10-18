import { z } from 'zod';

/**
 * Satın alma talebi oluşturma. clinicId/organizationId/requestedById bağlamdan gelir.
 *
 * Ondalık sınırları kolonlardan gelir: `purchase_request_items.quantity`
 * `Decimal(12,3)`, `estimated_unit_price` `Decimal(12,2)`. Tahmini fiyat talep
 * aşamasında bağlayıcı değil ama siparişe taşındığında sipariş tutarının
 * dayanağı olur; kapıda yuvarlanmayan bir değer DB'de sessizce yuvarlanırdı.
 */
export const CreatePurchaseRequestSchema = z.object({
  neededBy: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.uuid().nullable().optional(),
        description: z.string().min(1),
        quantity: z.number().positive().multipleOf(0.001, {
          message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
        }),
        estimatedUnitPrice: z
          .number()
          .nonnegative()
          .multipleOf(0.01, {
            message:
              'Tahmini birim fiyat en fazla 2 ondalık basamak taşıyabilir',
          })
          .nullable()
          .optional(),
        unit: z.string().nullable().optional(),
      })
    )
    .min(1),
  // organizationId ALINMAZ — `clinicId`'den çözülür (TENANT_SCOPE_RESOLVER).
  // Kiracı kimliği istemciden alınmaz: alan DTO'da durduğu sürece istemci
  // kontrolüne geçer ve yalnız doğrulamanın (klinik ↔ org uyuşması) tutmasına
  // bel bağlanır — oysa gönderilmesinin hiçbir meşru nedeni yok.
  clinicId: z.uuid(),
});
