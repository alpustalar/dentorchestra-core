export const INVENTORY_CATALOG_SERVICE = Symbol('IInventoryCatalogService');

export interface AssertProductsUsableParams {
  readonly clinicId: string;
  /** Doğrulanacak ürün kimlikleri; tekrarlar serviste ayıklanır. */
  readonly productIds: string[];
}

export interface AssertSupplierUsableParams {
  readonly clinicId: string;
  readonly supplierId: string;
}

export interface AssertCategoryUsableParams {
  readonly clinicId: string;
  readonly categoryId: string;
}

/**
 * Katalog kapısı — başka modüllerin (satın alma) kendi yazmasını durdurması için
 * `inventory`'nin açtığı domain servisi.
 *
 * Neden bus değil: bu bir sorgu değil, **yazmayı kapıda durduran bir invariant
 * kontrolü**. Veri dönmez; okuma Command Repo'dan yapılır (çağıranın yazma
 * bağlamına ait). Bkz. CLAUDE.md "Domain servisi istisnası".
 *
 * Neden gerekli: `PurchaseOrder.supplierId` / `items[].productId` bounded-context
 * gereği **FK'siz skaler**. Hiçbir yerde doğrulanmadığı sürece sipariş
 *  - var olmayan bir tedarikçiye (kimse teslim etmez, fatura eşleşmesi tutmaz),
 *  - **başka bir kiracının** ürün/tedarikçi kaydına,
 *  - silinmiş ya da pasife alınmış bir ürüne
 * açılabiliyordu. Son durumda mal kabulde stok partisi yazılır ama ürün
 * listeleri `deletedAt: null` süzdüğü için **girilen malın değeri hiçbir ekranda
 * görünmez** — envanter sessizce eksik kalır.
 */
export interface IInventoryCatalogService {
  /** Tedarikçi bu klinikte kullanılabilir mi? Değilse `DomainException` fırlatır. */
  assertSupplierUsable(params: AssertSupplierUsableParams): Promise<void>;

  /**
   * Verilen ürünlerin hepsi bu klinikte kullanılabilir mi? İlk kullanılamayan
   * üründe durur ve sebebiyle birlikte `DomainException` fırlatır.
   */
  assertProductsUsable(params: AssertProductsUsableParams): Promise<void>;

  /** Kategori bu kliniğin kataloğuna mı ait? (ürün kartının kategori bağı) */
  assertCategoryUsable(params: AssertCategoryUsableParams): Promise<void>;
}
