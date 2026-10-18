/**
 * Katalog kaydının (ürün / tedarikçi) bir klinikte kullanılabilir olup olmadığı —
 * saf kurallar.
 *
 * Tek dosyada durmasının sebebi CLAUDE.md finans kuralı 12'nin aynısıdır: kural
 * iki yerde (mal kabul eden `receive-stock` ile siparişi açan `purchasing`)
 * zorlanıyor; kopya yazıldığı an biri gevşer ve "sipariş açılabiliyor ama mal
 * kabul edilemiyor" (ya da tersi) durumuna düşülür.
 *
 * Kural 10 gereği `isActive` / `deletedAt` **okunan** bayraklardır: okunmayan bir
 * bayrak kolonu güvence değil süstür. Bu kontroller yazılmadan önce silinmiş
 * (soft-delete) bir ürüne stok girişi yapılabiliyordu — girilen mal hiçbir
 * listede görünmediği için envanter değeri sessizce kaybolurdu (ürün listeleri
 * `deletedAt: null` süzüyor).
 */

/** Kullanılamama sebebi — çağıran kullanıcıya ne söyleyeceğini buradan bilir. */
export type CatalogUnusableReason = 'OTHER_CLINIC' | 'DELETED' | 'INACTIVE';

export interface CatalogProductSnapshot {
  id: string;
  clinicId: string;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface CatalogSupplierSnapshot {
  id: string;
  clinicId: string;
  isActive: boolean;
}

/**
 * Ürün bu klinikte kullanılabilir mi? `null` → kullanılabilir.
 *
 * Başka kliniğin ürünü **kullanılamaz** sayılır: aksi halde kaydın `clinicId`'si
 * ile ürünün `clinicId`'si ayrışır, stok partisi A kliniğine yazılırken B
 * kliniğinin katalog kaydına bağlanır. İki tarafın listeleri de kendi
 * klinikleriyle süzdüğü için ortaya çıkan parti **hiçbir ekranda** görünmez.
 */
export function findProductUnusableReason(
  product: CatalogProductSnapshot,
  clinicId: string
): CatalogUnusableReason | null {
  if (product.clinicId !== clinicId) return 'OTHER_CLINIC';
  if (product.deletedAt) return 'DELETED';
  if (!product.isActive) return 'INACTIVE';
  return null;
}

/** Tedarikçi bu klinikte kullanılabilir mi? `null` → kullanılabilir. */
export function findSupplierUnusableReason(
  supplier: CatalogSupplierSnapshot,
  clinicId: string
): CatalogUnusableReason | null {
  if (supplier.clinicId !== clinicId) return 'OTHER_CLINIC';
  if (!supplier.isActive) return 'INACTIVE';
  return null;
}
