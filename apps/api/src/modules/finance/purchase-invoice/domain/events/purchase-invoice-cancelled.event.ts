import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { BaseEvent } from '@common/interfaces';
import { PURCHASE_INVOICE_EVENTS } from '@src/domain/constants/events/purchase-invoice.constant';

export interface PurchaseInvoiceCancelledEventPayload extends IAuditLog {
  purchaseInvoiceId: string;
  clinicId: string;
  organizationId: string;
  supplierId: string;
  invoiceNumber: string | null;
  /** İptal anında bağlı olduğu sipariş (sayaç bu siparişten düşüldü). */
  purchaseOrderId: string | null;
  grandTotal: string;
  currency: string;
  reason: string;
}

/**
 * Alış faturası iptal edildi — 320 borcu ve gider/stok kaydı defterde **storno**
 * ile götürüldü, belge yerinde kaldı (CLAUDE.md finans kuralı 8).
 *
 * Kalıcı damga zorunlu (kural 7): bir borcu hükümsüz kılmak, onu yazmaktan daha
 * yüksek etkili bir işlemdir.
 */
export class PurchaseInvoiceCancelledEvent extends BaseEvent {
  static readonly NAME = PURCHASE_INVOICE_EVENTS.CANCELLED;

  public readonly purchaseInvoiceId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly supplierId: string;
  public readonly invoiceNumber: string | null;
  public readonly purchaseOrderId: string | null;
  public readonly grandTotal: string;
  public readonly currency: string;
  public readonly reason: string;

  constructor(payload: PurchaseInvoiceCancelledEventPayload) {
    super(payload);
    this.purchaseInvoiceId = payload.purchaseInvoiceId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.supplierId = payload.supplierId;
    this.invoiceNumber = payload.invoiceNumber;
    this.purchaseOrderId = payload.purchaseOrderId;
    this.grandTotal = payload.grandTotal;
    this.currency = payload.currency;
    this.reason = payload.reason;
  }
}
