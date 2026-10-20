import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class PurchaseRequestNotFoundException extends DomainException<{
  requestId?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_REQUEST.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(requestId?: string) {
    super('Satın alma talebi bulunamadı.', { requestId });
  }
}

export class PurchaseRequestNotPendingException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_REQUEST.NOT_PENDING;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('Yalnızca onay bekleyen (SUBMITTED) talepler bu işleme uygundur.', {
      currentStatus,
    });
  }
}

export class PurchaseRequestNotApprovedException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_REQUEST.NOT_APPROVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('Siparişe yalnızca onaylanmış (APPROVED) talep dönüştürülebilir.', {
      currentStatus,
    });
  }
}

export class PurchaseRequestClinicMismatchException extends DomainException<{
  requestClinicId: string;
  orderClinicId: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_REQUEST.CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { requestClinicId: string; orderClinicId: string }) {
    super('Talep ile sipariş farklı kliniklere ait.', meta);
  }
}

export class PurchaseRequestEmptyItemsException extends DomainException {
  readonly errorCode = ERROR_CODES.PURCHASE_REQUEST.EMPTY_ITEMS;

  constructor(message = 'Satın alma talebi en az bir kalem içermelidir.') {
    super(message);
  }
}

export class PurchaseOrderNotFoundException extends DomainException<{
  orderId?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(orderId?: string) {
    super('Satın alma siparişi bulunamadı.', { orderId });
  }
}

export class PurchaseOrderEmptyItemsException extends DomainException {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.EMPTY_ITEMS;

  constructor(message = 'Sipariş en az bir kalem içermelidir.') {
    super(message);
  }
}

export class PurchaseOrderInvalidStateException extends DomainException<{
  currentStatus?: string;
  operation?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.INVALID_STATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message: string, currentStatus?: string, operation?: string) {
    super(message, { currentStatus, operation });
  }
}

export class PurchaseOrderItemNotFoundException extends DomainException<{
  itemId?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.ITEM_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(itemId?: string) {
    super('Sipariş kalemi bulunamadı.', { itemId });
  }
}

/**
 * Fatura eşleştirmede sipariş tutarının aşılması. 3'lü eşleştirmenin (sipariş ↔
 * mal kabul ↔ fatura) yakalamak için var olduğu asıl durum budur; frontend'in
 * farkı gösterebilmesi için sipariş/teslim/faturalanan tutarlar meta'da taşınır.
 */
export class PurchaseOrderOverInvoicedException extends DomainException<{
  orderId: string;
  orderedTotal: number;
  receivedValue: number;
  alreadyInvoiced: number;
  attempted: number;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.OVER_INVOICED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    orderId: string;
    orderedTotal: number;
    receivedValue: number;
    alreadyInvoiced: number;
    attempted: number;
  }) {
    super('Eşleştirilen fatura toplamı sipariş tutarını aşamaz.', meta);
  }
}

export class PurchaseOrderNotBillableException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.NOT_BILLABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('Taslak veya iptal edilmiş siparişe fatura eşleştirilemez.', {
      currentStatus,
    });
  }
}

export class PurchaseOrderSupplierMismatchException extends DomainException<{
  orderSupplierId: string;
  invoiceSupplierId: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.SUPPLIER_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { orderSupplierId: string; invoiceSupplierId: string }) {
    super('Fatura ile siparişin tedarikçisi aynı değil.', meta);
  }
}

export class PurchaseOrderCurrencyMismatchException extends DomainException<{
  orderCurrency: string;
  invoiceCurrency: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.CURRENCY_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { orderCurrency: string; invoiceCurrency: string }) {
    super('Fatura ile siparişin para birimi aynı değil.', meta);
  }
}

export class PurchaseOrderClinicMismatchException extends DomainException<{
  orderClinicId: string;
  invoiceClinicId: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.CLINIC_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { orderClinicId: string; invoiceClinicId: string }) {
    super('Fatura ile sipariş farklı kliniklere ait.', meta);
  }
}

export class PurchaseOrderOverReceiptException extends DomainException<{
  itemId: string;
  ordered: number;
  alreadyReceived: number;
  attempted: number;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.OVER_RECEIPT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    itemId: string;
    ordered: number;
    alreadyReceived: number;
    attempted: number;
  }) {
    super('Teslim alınan miktar sipariş edilen miktarı aşamaz.', meta);
  }
}

/**
 * Mal kabul miktarı sıfır ya da negatif. Kabul günlüğü satırı `quantity > 0` ister (DB
 * CHECK da vardır); HTTP kapısı zaten pozitif şart koşar, entity ise DTO'dan geçmeyen iç
 * çağrılar içindir. Sıfır miktarlı bir günlük satırı GRNI hesabında hiçbir şey eklemez
 * ama sayaçla günlüğün tutarlılığını bozmadan da kalamaz — baştan reddedilir.
 */
export class PurchaseOrderInvalidReceiptQuantityException extends DomainException<{
  itemId: string;
  quantity: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.INVALID_RECEIPT_QUANTITY;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: { itemId: string; quantity: string }) {
    super('Teslim alınan miktar sıfırdan büyük olmalıdır.', meta);
  }
}

export class PurchaseOrderCancelWithInvoicesException extends DomainException<{
  orderId: string;
  invoicedTotal: string;
  billingStatus: string;
}> {
  readonly errorCode = ERROR_CODES.PURCHASE_ORDER.CANCEL_WITH_INVOICES;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    orderId: string;
    invoicedTotal: string;
    billingStatus: string;
  }) {
    super(
      'Faturası eşleştirilmiş sipariş iptal edilemez; önce fatura eşleştirmesi kaldırılmalıdır.',
      meta
    );
  }
}
