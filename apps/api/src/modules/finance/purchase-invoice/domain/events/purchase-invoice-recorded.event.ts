import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { BaseEvent } from '@common/interfaces';
import { PURCHASE_INVOICE_EVENTS } from '@src/domain/constants/events/purchase-invoice.constant';

export interface PurchaseInvoiceRecordedEventPayload extends IAuditLog {
  purchaseInvoiceId: string;
  clinicId: string;
  organizationId: string;
  supplierId: string;
  invoiceNumber: string | null;
  grandTotal: string;
  currency: string;
}

/**
 * Alış faturası kaydedildi — klinik adına bir **borç** (320) ve gider yazıldı.
 *
 * Yüksek etkili finansal işlem olduğu için kalıcı damga ister (CLAUDE.md finans
 * kuralı 7): "bu borcu kim, ne zaman, hangi belgeyle yazdı" sorusu audit log'dan
 * yanıtlanır.
 */
export class PurchaseInvoiceRecordedEvent extends BaseEvent {
  static readonly NAME = PURCHASE_INVOICE_EVENTS.RECORDED;

  public readonly purchaseInvoiceId: string;
  public readonly clinicId: string;
  public readonly organizationId: string;
  public readonly supplierId: string;
  public readonly invoiceNumber: string | null;
  public readonly grandTotal: string;
  public readonly currency: string;

  constructor(payload: PurchaseInvoiceRecordedEventPayload) {
    super(payload);
    this.purchaseInvoiceId = payload.purchaseInvoiceId;
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
    this.supplierId = payload.supplierId;
    this.invoiceNumber = payload.invoiceNumber;
    this.grandTotal = payload.grandTotal;
    this.currency = payload.currency;
  }
}
