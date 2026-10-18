import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { BaseEvent } from '@common/interfaces';
import { INVOICE_EVENTS } from '@src/domain/constants/events/invoice.constant';

export interface InvoiceCancelledEventPayload extends IAuditLog {
  invoiceId: string;
  organizationId: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  paymentId: string | null;
  /** İptal edilen belgenin numarası — numara yakılır, yeniden kullanılmaz. */
  invoiceNumber: string | null;
  /** Entegratöre iptal bildirimi gerekiyorsa belgenin ETTN/UUID'si. */
  einvoiceUuid: string | null;
  reason: string;
  grandTotal: string;
  currency: string;
}

/**
 * Satış faturası iptal edildi (storno). Defterdeki ters kayıt iptal komutuyla
 * **aynı transaction** içinde atılır; bu olay denetim izini ve entegratör iptal
 * bildirimini (doc 07 §5 — outbound, iptali bloklamaz) tetikler.
 */
export class InvoiceCancelledEvent extends BaseEvent {
  static readonly NAME = INVOICE_EVENTS.CANCELLED;

  public readonly invoiceId: string;
  public readonly organizationId: string;
  public readonly clinicId: string;
  public readonly patientId: string;
  public readonly appointmentId: string | null;
  public readonly paymentId: string | null;
  public readonly invoiceNumber: string | null;
  public readonly einvoiceUuid: string | null;
  public readonly reason: string;
  public readonly grandTotal: string;
  public readonly currency: string;

  constructor(payload: InvoiceCancelledEventPayload) {
    super(payload);
    this.invoiceId = payload.invoiceId;
    this.organizationId = payload.organizationId;
    this.clinicId = payload.clinicId;
    this.patientId = payload.patientId;
    this.appointmentId = payload.appointmentId;
    this.paymentId = payload.paymentId;
    this.invoiceNumber = payload.invoiceNumber;
    this.einvoiceUuid = payload.einvoiceUuid;
    this.reason = payload.reason;
    this.grandTotal = payload.grandTotal;
    this.currency = payload.currency;
  }
}
