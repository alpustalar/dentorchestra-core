import { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';
import {
  EDocumentRequest,
  EDocumentResult,
  MailboxInfo,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';

export const E_INVOICE_PORT = Symbol('EInvoicePort');

/**
 * e-Belge portu. Çekirdek yalnız bu interface'i tanır; Logo/Nilvera/GİB
 * birer adapter'dır. Entegratör kapalıyken NoopEInvoiceAdapter devrededir.
 */
export interface EInvoicePort {
  issue(req: EDocumentRequest): Promise<EDocumentResult>;
  cancel(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
    reason: string;
  }): Promise<void>;
  getStatus(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
  }): Promise<EDocumentStatus>;
  checkMailbox(clinicId: string, taxId: string): Promise<MailboxInfo>;
}
