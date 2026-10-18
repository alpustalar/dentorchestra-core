import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

export class PurchaseInvoiceNotFoundException extends DomainException<{
  invoiceId?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(invoiceId?: string) {
    super('Alış faturası bulunamadı.', { invoiceId });
  }
}

export class PurchaseInvoiceAlreadyMatchedException extends DomainException<{
  invoiceId: string;
  purchaseOrderId: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.ALREADY_MATCHED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; purchaseOrderId: string }) {
    super(
      'Fatura zaten bir siparişe eşleştirilmiş. Önce mevcut eşleştirmeyi kaldırın.',
      meta
    );
  }
}

export class PurchaseInvoiceNotMatchedException extends DomainException<{
  invoiceId?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.NOT_MATCHED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(invoiceId?: string) {
    super('Fatura herhangi bir siparişe eşleştirilmemiş.', { invoiceId });
  }
}

export class PurchaseInvoiceNotMatchableException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.NOT_MATCHABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('İptal edilmiş fatura siparişe eşleştirilemez.', { currentStatus });
  }
}

/**
 * Aynı tedarikçinin aynı belge numarası bu klinikte zaten kayıtlı.
 *
 * DB'deki doğal anahtar kısıtı (`clinic_id + supplier_id + invoice_number`) bunu
 * reddetti. Mükerrer alış faturası defterde gideri ve 320 borcunu iki kez, KDV
 * indirimini de iki kez yazardı; bu yüzden idempotent "mevcut olanı dön" değil,
 * kullanıcıya görünür bir çakışma hatası veriyoruz — belgeyi kimin, hangi tutarla
 * girdiği bilinçli bir karardır.
 */
export class PurchaseInvoiceDuplicateException extends DomainException<{
  clinicId?: string;
  supplierId?: string;
  invoiceNumber?: string | null;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.DUPLICATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta?: {
    clinicId?: string;
    supplierId?: string;
    invoiceNumber?: string | null;
  }) {
    super(
      'Bu tedarikçinin bu belge numaralı faturası zaten kayıtlı.',
      meta ?? {}
    );
  }
}

/** Genel toplam, matrah + KDV toplamına eşit değil (fiş dengesiz kalırdı). */
export class PurchaseInvoiceUnbalancedTotalsException extends DomainException<{
  netTotal: string;
  vatTotal: string;
  grandTotal: string;
  expectedGrandTotal: string;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.UNBALANCED_TOTALS;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: {
    netTotal: string;
    vatTotal: string;
    grandTotal: string;
    expectedGrandTotal: string;
  }) {
    super(
      `Genel toplam (${meta.grandTotal}) matrah + KDV toplamına (${meta.expectedGrandTotal}) eşit olmalıdır.`,
      meta
    );
  }
}

/** Beyan edilen KDV tutarı, matrah × KDV oranıyla uyuşmuyor. */
export class PurchaseInvoiceVatMismatchException extends DomainException<{
  netTotal: string;
  vatTotal: string;
  vatRate: number;
  expectedVatTotal: string;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.VAT_MISMATCH;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: {
    netTotal: string;
    vatTotal: string;
    vatRate: number;
    expectedVatTotal: string;
  }) {
    super(
      `KDV tutarı (${meta.vatTotal}) %${meta.vatRate} oranında beklenen tutarla (${meta.expectedVatTotal}) uyuşmuyor.`,
      meta
    );
  }
}

/** Tutar kuruştan küçük hassasiyet taşıyor (kolonlar `Decimal(12,2)`). */
export class PurchaseInvoiceInvalidPrecisionException extends DomainException<{
  field: string;
  value: string;
  maxDecimals: number;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.INVALID_PRECISION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: { field: string; value: string; maxDecimals: number }) {
    super(
      `Tutar en fazla ${meta.maxDecimals} ondalık basamak taşıyabilir (${meta.field}: ${meta.value}).`,
      meta
    );
  }
}

/** Gelecek tarihli alış faturası kaydedilemez. */
export class PurchaseInvoiceInvalidDateException extends DomainException<{
  invoiceDate: string;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.INVALID_INVOICE_DATE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: { invoiceDate: string }) {
    super('Gelecek tarihli alış faturası kaydedilemez.', meta);
  }
}

/**
 * Alış faturası zaten iptal edilmiş. İkinci iptal denemesi reddedilir: iptal hem
 * defterde storno fişi üretir hem sipariş sayacından düşer — tekrarı, aynı
 * belgenin etkisini iki kez götürür ve siparişin faturalanmış tutarını negatife
 * çeker. Hata sessizdir (storno fişi kendi içinde dengelidir).
 */
export class PurchaseInvoiceAlreadyCancelledException extends DomainException<{
  invoiceId: string;
  cancelledAt: string | null;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; cancelledAt: string | null }) {
    super('Alış faturası zaten iptal edilmiş.', meta);
  }
}

/**
 * Ödemesi yapılmış (ya da kısmen yapılmış) alış faturası iptal edilemez.
 *
 * İptal 320 Satıcılar borcunu storno ile kapatır; ödeme fişi (320 / 100-102)
 * yerinde kalır ve tedarikçi cari bakiyesi **ters işaretle** (bizim alacaklı
 * göründüğümüz) bir tutara düşer. Doğru yol tedarikçi ödemesini önce geri
 * almaktır — bu, faturadan bağımsız bir karardır.
 */
export class PurchaseInvoiceNotCancellableException extends DomainException<{
  invoiceId: string;
  currentStatus: string;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.NOT_CANCELLABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; currentStatus: string }) {
    super(
      'Ödemesi yapılmış alış faturası iptal edilemez; önce tedarikçi ödemesi geri alınmalıdır.',
      meta
    );
  }
}

/**
 * İptal edilmiş faturanın sipariş eşleştirmesi ayrıca kaldırılamaz.
 *
 * İptal, siparişin `invoicedTotal` sayacını **zaten** düşürmüştü (bağ iz olarak
 * duruyor). Ayrıca "eşleştirmeyi kaldır" çağrılırsa aynı tutar ikinci kez
 * düşülür ve sipariş, hiç faturalanmamış gibi (hatta negatif) görünür.
 */
export class PurchaseInvoiceNotUnmatchableException extends DomainException<{
  invoiceId: string;
  currentStatus: string;
}> {
  public readonly errorCode = ERROR_CODES.PURCHASE_INVOICE.NOT_UNMATCHABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; currentStatus: string }) {
    super(
      'İptal edilmiş faturanın sipariş eşleştirmesi kaldırılamaz; sayaç iptalde zaten düşüldü.',
      meta
    );
  }
}
