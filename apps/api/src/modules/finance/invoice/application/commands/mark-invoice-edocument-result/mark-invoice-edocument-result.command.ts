import { IGetContext } from '@common/decorators';
import { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';

export interface MarkInvoiceEDocumentResultInput {
  invoiceId: string;
  documentType: EDocumentType;
  uuid: string | null;
  status: EDocumentStatus;
  invoiceNumber?: string | null;
  providerRef?: string | null;
  rawResponse?: unknown;
}

/**
 * e-Belge gönderim sonucunu faturaya işler (entegratör → invoice). e-document
 * processor'ı port sonucunu alınca bunu CommandBus ile dispatch eder.
 */
export class MarkInvoiceEDocumentResultCommand {
  readonly __responseType!: void;
  constructor(
    public readonly input: MarkInvoiceEDocumentResultInput,
    public readonly ctx: IGetContext
  ) {}
}
