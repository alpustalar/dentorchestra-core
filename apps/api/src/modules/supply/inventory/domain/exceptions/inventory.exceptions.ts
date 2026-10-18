import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { CatalogUnusableReason } from '@modules/supply/inventory/domain/rules/catalog-usability.rules';

export class ProductNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.INVENTORY.PRODUCT_NOT_FOUND;
  // `httpStatus: HttpStatus.NOT_FOUND` (iki nokta) ATAMA değil tip
  // anotasyonudur: alan tanımsız kalır ve taban sınıfın 400'ü döner. Eşittir
  // olmalı — aynı tuzak `UserNotFoundException`'da da notlanmıştı.
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor(message = 'Ürün bulunamadı') {
    super(message);
  }
}

export class SupplierNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.INVENTORY.SUPPLIER_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor(id?: string) {
    super('Tedarikçi bulunamadı', { id });
  }
}

/**
 * Ürün bu klinikte kullanılamıyor: başka kliniğin kataloğuna ait, silinmiş ya da
 * pasife alınmış. Üçü de aynı sonucu doğurur — o ürün üzerinden stok/para
 * hareketi yazmak kaydı görünmez bir yere düşürür — ama sebep ayrı ayrı
 * bildirilir ki kullanıcı ne yapacağını bilsin.
 */
export class ProductNotUsableInClinicException extends DomainException<{
  productId: string;
  reason: CatalogUnusableReason;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.PRODUCT_NOT_USABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { productId: string; reason: CatalogUnusableReason }) {
    super(
      meta.reason === 'OTHER_CLINIC'
        ? 'Ürün bu kliniğin kataloğunda değil.'
        : meta.reason === 'DELETED'
          ? 'Silinmiş ürün kullanılamaz.'
          : 'Pasif ürün kullanılamaz.',
      meta
    );
  }
}

/** Tedarikçi bu klinikte kullanılamıyor (başka klinik ya da pasif). */
export class SupplierNotUsableInClinicException extends DomainException<{
  supplierId: string;
  reason: CatalogUnusableReason;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.SUPPLIER_NOT_USABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { supplierId: string; reason: CatalogUnusableReason }) {
    super(
      meta.reason === 'OTHER_CLINIC'
        ? 'Tedarikçi bu kliniğin kayıtlarında değil.'
        : 'Pasif tedarikçi ile işlem yapılamaz.',
      meta
    );
  }
}

/** Ürün kategorisi bulunamadı. */
export class ProductCategoryNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.INVENTORY.CATEGORY_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Ürün kategorisi bulunamadı') {
    super(message);
  }
}

/** Ürün kategorisi bu klinikte kullanılamıyor (başka klinik). */
export class CategoryNotUsableInClinicException extends DomainException<{
  categoryId: string;
  reason: CatalogUnusableReason;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.CATEGORY_NOT_USABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { categoryId: string; reason: CatalogUnusableReason }) {
    super('Kategori bu kliniğin kataloğunda değil.', meta);
  }
}

/**
 * Son kullanma tarihi geçmiş parti açılamaz. Ham `Error` idi: domain hatası
 * HTTP sınırında 500'e dönüşüyor, kullanıcıya sebebi gitmiyordu.
 */
export class BatchExpiredException extends DomainException<{
  expiresAt: string;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.BATCH_EXPIRED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { expiresAt: string }) {
    super('Son kullanma tarihi geçmiş bir ürün partisi oluşturulamaz.', meta);
  }
}

/** Düşülecek uygun bir lot/parti yok (ürünün hiç açık partisi kalmamış). */
export class NoLotToDeductException extends DomainException<{
  productId: string;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.NO_LOT_TO_DEDUCT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { productId: string }) {
    super('Düşüm yapılacak uygun bir lot/parti bulunamadı.', meta);
  }
}

/**
 * Partisi olmayan ürüne sayım düzeltmesiyle **giriş** yapılamaz.
 *
 * Eski davranış sessiz bir yalandı: partisi olmayan artışta yalnız hareket kaydı
 * yazılıyor, parti açılmıyordu. Stok seviyesi `Σ product_batches.quantity`
 * olduğu için **miktar hiç artmıyordu** — kullanıcı "düzeltme yapıldı" cevabı
 * alıyor, stok olduğu yerde kalıyordu. Üstelik girişin maliyeti (birim fiyat,
 * para birimi) de yoktu; parti açılsa bile envanter değeri sıfır girerdi.
 * Doğru yol mal kabul (`receive-stock`): tedarikçi, fiyat ve lot bilgisiyle.
 */
export class StockIncreaseRequiresReceiptException extends DomainException<{
  productId: string;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.INCREASE_REQUIRES_RECEIPT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { productId: string }) {
    super(
      'Bu ürünün açık bir partisi yok: giriş, maliyeti ve lot bilgisiyle mal kabul üzerinden yapılmalıdır.',
      meta
    );
  }
}

/** Ürünün tüketilebilir (miktarı > 0, SKT geçmemiş) partisi yok. */
export class NoAvailableStockException extends DomainException<{
  productId: string;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.NO_AVAILABLE_STOCK;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { productId: string }) {
    super('Kullanılabilir stok bulunamadı.', meta);
  }
}

/**
 * Üzerinde stok duran ürün silinemez.
 *
 * Silme `deletedAt` damgalıyor; stok seviyesi sorgusu ürünleri `deletedAt: null`
 * süzdüğü için partiler yerinde kalır ama **envanter değeri hiçbir listede
 * görünmez** — para kaybı sessizdir. Önce stok sıfırlanır (kullanım / zayi /
 * sayım düzeltmesi), sonra ürün silinir.
 */
export class ProductHasStockException extends DomainException<{
  productId: string;
  onHandQuantity: string;
}> {
  public readonly errorCode = ERROR_CODES.INVENTORY.PRODUCT_HAS_STOCK;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { productId: string; onHandQuantity: string }) {
    super(
      'Üzerinde stok bulunan ürün silinemez; önce stok sıfırlanmalıdır.',
      meta
    );
  }
}
