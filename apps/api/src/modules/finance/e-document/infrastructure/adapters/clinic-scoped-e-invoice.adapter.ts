import { Injectable } from '@nestjs/common';
import type { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import type { EInvoicePort } from '@modules/finance/e-document/domain/ports/e-invoice.port';
import type {
  EDocumentRequest,
  EDocumentResult,
  MailboxInfo,
  ResolvedEDocumentIntegration,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { ResolveEDocumentIntegrationService } from '@modules/finance/e-document/application/services/resolve-e-document-integration.service';
import { NoopEInvoiceAdapter } from './noop/noop-e-invoice.adapter';
import { NilveraEInvoiceAdapter } from './nilvera/nilvera-e-invoice.adapter';

@Injectable()
export class ClinicScopedEInvoiceAdapter implements EInvoicePort {
  constructor(
    private readonly resolver: ResolveEDocumentIntegrationService,
    private readonly noop: NoopEInvoiceAdapter,
    private readonly nilvera: NilveraEInvoiceAdapter
  ) {}

  async issue(req: EDocumentRequest): Promise<EDocumentResult> {
    const integration = await this.resolver.resolveOptional(req.clinicId);
    if (!integration) return this.noop.issue(req);
    return this.provider(integration).issue(req, integration);
  }

  async cancel(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
    reason: string;
  }): Promise<void> {
    const integration = await this.resolver.resolve(input.clinicId);
    return this.provider(integration).cancel(input, integration);
  }

  async getStatus(input: {
    clinicId: string;
    documentType: EDocumentType;
    uuid: string;
  }): Promise<EDocumentStatus> {
    const integration = await this.resolver.resolve(input.clinicId);
    return this.provider(integration).getStatus(input, integration);
  }

  async checkMailbox(clinicId: string, taxId: string): Promise<MailboxInfo> {
    const integration = await this.resolver.resolve(clinicId);
    return this.provider(integration).checkMailbox(taxId, integration);
  }

  private provider(integration: ResolvedEDocumentIntegration) {
    switch (integration.provider) {
      case 'NILVERA':
        return this.nilvera;
      default:
        throw new Error(
          `E-belge sağlayıcı adapter'ı hazır değil: ${integration.provider}`
        );
    }
  }
}
