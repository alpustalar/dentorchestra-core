import { Injectable } from '@nestjs/common';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import type { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentProviderAdapter } from '@modules/finance/e-document/domain/ports/e-document-provider.adapter';
import type {
  EDocumentRequest,
  EDocumentResult,
  MailboxInfo,
  ResolvedEDocumentIntegration,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import {
  NilveraCompanyResponseSchema,
  NilveraIssueResponseSchema,
  NilveraStatusResponseSchema,
  NilveraTaxpayerCheckResponseSchema,
} from './nilvera.contracts';
import {
  mapNilveraEArchivePayload,
  mapNilveraEInvoicePayload,
} from './nilvera-payload.mapper';
import { NilveraApiError, NilveraHttpClient } from './nilvera-http.client';

@Injectable()
export class NilveraEInvoiceAdapter implements EDocumentProviderAdapter {
  constructor(private readonly client: NilveraHttpClient) {}

  async issue(
    req: EDocumentRequest,
    integration: ResolvedEDocumentIntegration
  ): Promise<EDocumentResult> {
    const target = this.issueTarget(req);
    const rawResponse = await this.client.post<unknown>(
      this.connection(integration),
      target.path,
      target.payload
    );
    const result = NilveraIssueResponseSchema.parse(rawResponse);

    return {
      documentType: req.type,
      uuid: result.UUID,
      invoiceNumber: result.InvoiceNumber ?? null,
      status: EDocumentStatusSchema.enum.SENT,
      rawResponse,
    };
  }

  async cancel(
    input: {
      documentType: EDocumentType;
      uuid: string;
      reason: string;
    },
    integration: ResolvedEDocumentIntegration
  ): Promise<void> {
    if (input.documentType !== EDocumentTypeSchema.enum.E_ARSIV) {
      throw new Error(
        `Nilvera üzerinden otomatik iptal yalnız E_ARSIV için destekleniyor; belge türü=${input.documentType}`
      );
    }

    await this.client.put<unknown>(
      this.connection(integration),
      `/earchive/Invoices/${encodeURIComponent(input.uuid)}/Cancel`
    );
  }

  async getStatus(
    input: { documentType: EDocumentType; uuid: string },
    integration: ResolvedEDocumentIntegration
  ): Promise<EDocumentStatus> {
    const prefix = this.documentPrefix(input.documentType);
    const raw = await this.client.get<unknown>(
      this.connection(integration),
      `${prefix}/${encodeURIComponent(input.uuid)}/Status`
    );
    const status = NilveraStatusResponseSchema.parse(raw);
    return this.mapStatus(status.StatusCode, status.CancelStatus);
  }

  async checkMailbox(
    taxId: string,
    integration: ResolvedEDocumentIntegration
  ): Promise<MailboxInfo> {
    const connection = this.connection(integration);
    try {
      const raw = await this.client.get<unknown>(
        connection,
        `/general/GlobalCompany/Check/TaxNumber/${encodeURIComponent(taxId)}`,
        { params: { globalUserType: 'Invoice' } }
      );
      NilveraTaxpayerCheckResponseSchema.parse(raw);
    } catch (error) {
      if (error instanceof NilveraApiError && error.status === 404) {
        return { isEInvoiceUser: false };
      }
      throw error;
    }

    const details = await this.client.get<unknown>(
      connection,
      `/general/GlobalCompany/GetGlobalCustomerInfo/${encodeURIComponent(taxId)}`,
      { params: { globalUserType: 'Invoice' } }
    );

    const alias = this.findAlias(details);
    return alias ? { isEInvoiceUser: true, alias } : { isEInvoiceUser: true };
  }

  async testConnection(
    integration: ResolvedEDocumentIntegration
  ): Promise<{ companyTitle: string | null; taxNumber: string | null }> {
    const raw = await this.client.get<unknown>(
      this.connection(integration),
      '/general/Company'
    );
    const company = NilveraCompanyResponseSchema.parse(raw);
    return {
      companyTitle: company.Title ?? company.Name ?? null,
      taxNumber: company.TaxNumber ?? null,
    };
  }

  private connection(integration: ResolvedEDocumentIntegration) {
    if (integration.credentials.provider !== 'NILVERA') {
      throw new Error('Nilvera adapter yanlış sağlayıcı kimliğiyle çağrıldı.');
    }
    return {
      environment: integration.environment,
      apiKey: integration.credentials.apiKey,
    };
  }

  private issueTarget(req: EDocumentRequest): {
    path: string;
    payload: unknown;
  } {
    if (req.type === EDocumentTypeSchema.enum.E_FATURA) {
      return {
        path: '/einvoice/Send/Model',
        payload: mapNilveraEInvoicePayload(req),
      };
    }
    if (req.type === EDocumentTypeSchema.enum.E_ARSIV) {
      return {
        path: '/earchive/Send/Model',
        payload: mapNilveraEArchivePayload(req),
      };
    }
    throw new Error(`Nilvera belge türü desteklenmiyor: ${req.type}`);
  }

  private documentPrefix(documentType: EDocumentType): string {
    if (documentType === EDocumentTypeSchema.enum.E_FATURA) {
      return '/einvoice/Sale';
    }
    if (documentType === EDocumentTypeSchema.enum.E_ARSIV) {
      return '/earchive/Invoices';
    }
    throw new Error(`Nilvera durum sorgusu desteklenmiyor: ${documentType}`);
  }

  private mapStatus(
    rawStatus: string | null | undefined,
    cancelled: boolean | undefined
  ): EDocumentStatus {
    if (cancelled) return EDocumentStatusSchema.enum.REJECTED;

    switch (rawStatus?.toLocaleLowerCase('tr-TR')) {
      case 'succeed':
      case 'sent':
        return EDocumentStatusSchema.enum.SENT;
      case 'accepted':
      case 'kabul':
        return EDocumentStatusSchema.enum.ACCEPTED;
      case 'rejected':
      case 'red':
        return EDocumentStatusSchema.enum.REJECTED;
      case 'waiting':
      case 'queued':
        return EDocumentStatusSchema.enum.QUEUED;
      case 'error':
        return EDocumentStatusSchema.enum.FAILED;
      default:
        return EDocumentStatusSchema.enum.QUEUED;
    }
  }

  private findAlias(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value.startsWith('urn:mail:') ? value : undefined;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const alias = this.findAlias(item);
        if (alias) return alias;
      }
      return undefined;
    }
    if (value !== null && typeof value === 'object') {
      for (const item of Object.values(value)) {
        const alias = this.findAlias(item);
        if (alias) return alias;
      }
    }
    return undefined;
  }
}
