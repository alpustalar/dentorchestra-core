import { Injectable, Logger } from '@nestjs/common';
import {
  EDocumentStatusSchema,
  EDocumentStatusType as EDocumentStatus,
} from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import { EInvoicePort } from '@modules/finance/e-document/domain/ports/e-invoice.port';
import {
  EDocumentRequest,
  EDocumentResult,
  MailboxInfo,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';

/**
 * Entegratör kapalıyken devrede olan fallback (doc 07 §1). Belge INTERNAL (iç belge)
 * olarak üretilir; ETTN/UUID atanmaz, dış gönderim yapılmaz; hata FIRLATMAZ.
 * Böylece sistem önmuhasebe + fiş seviyesinde tam çalışır.
 */
@Injectable()
export class NoopEInvoiceAdapter implements EInvoicePort {
  private readonly logger = new Logger(NoopEInvoiceAdapter.name);

  issue(req: EDocumentRequest): Promise<EDocumentResult> {
    this.logger.log(
      `Entegratör kapalı — iç belge (INTERNAL) üretildi. invoiceId=${req.invoiceId}, çözülen tür=${req.type}`
    );
    return Promise.resolve({
      documentType: EDocumentTypeSchema.enum.INTERNAL,
      uuid: null,
      status: EDocumentStatusSchema.enum.INTERNAL,
      invoiceNumber: null,
      rawResponse: { adapter: 'noop', note: 'entegratör kapalı — iç belge' },
    });
  }

  cancel(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
    reason: string;
  }): Promise<void> {
    this.logger.log(
      `Entegratör kapalı — iptal no-op. uuid=${input.uuid}, neden=${input.reason}`
    );
    return Promise.resolve();
  }

  getStatus(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
  }): Promise<EDocumentStatus> {
    void input;
    return Promise.resolve(EDocumentStatusSchema.enum.INTERNAL);
  }

  checkMailbox(clinicId: string, taxId: string): Promise<MailboxInfo> {
    void clinicId;
    void taxId;
    return Promise.resolve({ isEInvoiceUser: false });
  }
}
