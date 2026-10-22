/* eslint-disable @typescript-eslint/unbound-method */
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentRequest } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import type { ResolveEDocumentIntegrationService } from '@modules/finance/e-document/application/services/resolve-e-document-integration.service';
import type { NoopEInvoiceAdapter } from './noop/noop-e-invoice.adapter';
import type { NilveraEInvoiceAdapter } from './nilvera/nilvera-e-invoice.adapter';
import { ClinicScopedEInvoiceAdapter } from './clinic-scoped-e-invoice.adapter';

describe('ClinicScopedEInvoiceAdapter', () => {
  const request: EDocumentRequest = {
    clinicId: 'clinic-1',
    type: EDocumentTypeSchema.enum.E_ARSIV,
    invoiceId: 'invoice-1',
    idempotencyKey: '8a8c32be-b07f-4f2b-8749-bce10779f551',
    issueDate: new Date('2026-10-21T10:00:00.000Z'),
    seller: { taxId: '1234567890', name: 'Klinik' },
    buyer: { taxId: '11111111111', name: 'Hasta' },
    lines: [
      {
        name: 'Muayene',
        quantity: 1,
        unitPrice: '100.00',
        vatRate: 10,
        vatAmount: '10.00',
      },
    ],
    totals: { net: '100.00', vat: '10.00', payable: '110.00' },
    currency: 'TRY',
  };

  const integration = {
    configId: 'config-1',
    scope: 'CLINIC' as const,
    sourceId: 'clinic-1',
    provider: 'NILVERA' as const,
    environment: 'TEST' as const,
    credentials: {
      provider: 'NILVERA' as const,
      apiKey: 'nilvera-secret-key',
    },
  };

  const make = () => {
    const resolver = {
      resolveOptional: jest.fn(),
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveEDocumentIntegrationService>;
    const noop = {
      issue: jest.fn(),
    } as unknown as jest.Mocked<NoopEInvoiceAdapter>;
    const nilvera = {
      issue: jest.fn(),
      cancel: jest.fn(),
      getStatus: jest.fn(),
      checkMailbox: jest.fn(),
    } as unknown as jest.Mocked<NilveraEInvoiceAdapter>;
    return {
      adapter: new ClinicScopedEInvoiceAdapter(resolver, noop, nilvera),
      resolver,
      noop,
      nilvera,
    };
  };

  it('konfigürasyon yoksa dış servise göndermeyip INTERNAL fallback kullanır', async () => {
    const { adapter, resolver, noop, nilvera } = make();
    resolver.resolveOptional.mockResolvedValue(null);
    noop.issue.mockResolvedValue({
      documentType: EDocumentTypeSchema.enum.INTERNAL,
      uuid: null,
      status: EDocumentStatusSchema.enum.INTERNAL,
      invoiceNumber: null,
    });

    await adapter.issue(request);

    expect(noop.issue).toHaveBeenCalledWith(request);
    expect(nilvera.issue).not.toHaveBeenCalled();
  });

  it('klinik credentialı varsa Nilvera adapterına aktarır', async () => {
    const { adapter, resolver, nilvera, noop } = make();
    resolver.resolveOptional.mockResolvedValue(integration);
    nilvera.issue.mockResolvedValue({
      documentType: EDocumentTypeSchema.enum.E_ARSIV,
      uuid: request.idempotencyKey,
      status: EDocumentStatusSchema.enum.SENT,
      invoiceNumber: 'ARS2026000000001',
    });

    await adapter.issue(request);

    expect(nilvera.issue).toHaveBeenCalledWith(request, integration);
    expect(noop.issue).not.toHaveBeenCalled();
  });

  it('iptal ve durum sorgusunda fallback yapmayıp konfigürasyon zorunlu tutar', async () => {
    const { adapter, resolver, nilvera } = make();
    resolver.resolve.mockRejectedValue(new Error('not configured'));
    const cancelInput = {
      clinicId: 'clinic-1',
      documentType: EDocumentTypeSchema.enum.E_ARSIV,
      uuid: request.idempotencyKey,
      reason: 'Hatalı belge',
    };

    await expect(adapter.cancel(cancelInput)).rejects.toThrow('not configured');
    await expect(
      adapter.getStatus({
        clinicId: 'clinic-1',
        documentType: EDocumentTypeSchema.enum.E_ARSIV,
        uuid: request.idempotencyKey,
      })
    ).rejects.toThrow('not configured');
    expect(nilvera.cancel).not.toHaveBeenCalled();
    expect(nilvera.getStatus).not.toHaveBeenCalled();
  });
});
