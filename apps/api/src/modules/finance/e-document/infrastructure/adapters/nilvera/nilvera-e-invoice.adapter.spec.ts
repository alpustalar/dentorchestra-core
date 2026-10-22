/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import type { EDocumentRequest } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { NilveraEInvoiceAdapter } from './nilvera-e-invoice.adapter';
import { NilveraApiError, NilveraHttpClient } from './nilvera-http.client';
import type { ResolvedEDocumentIntegration } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

describe('NilveraEInvoiceAdapter', () => {
  const request: EDocumentRequest = {
    clinicId: 'clinic-1',
    type: EDocumentTypeSchema.enum.E_FATURA,
    invoiceId: 'invoice-1',
    idempotencyKey: '8a8c32be-b07f-4f2b-8749-bce10779f551',
    issueDate: new Date('2026-10-21T10:00:00.000Z'),
    seller: {
      taxId: '1234567890',
      name: 'Örnek Klinik',
      address: 'Test Caddesi 1',
      city: 'İstanbul',
      district: 'Kadıköy',
    },
    buyer: {
      taxId: '11111111111',
      name: 'Hasta Adı',
      address: 'Hasta Adresi',
      isEInvoiceUser: true,
      alias: 'urn:mail:defaultpk@hasta.example',
    },
    lines: [
      {
        name: 'Muayene',
        quantity: 1,
        unitPrice: '1000.00',
        vatRate: 10,
        vatAmount: '100.00',
      },
    ],
    totals: { net: '1000.00', vat: '100.00', payable: '1100.00' },
    currency: 'TRY',
    note: 'Test faturası',
  };

  const integration: ResolvedEDocumentIntegration = {
    configId: 'config-1',
    scope: 'CLINIC',
    sourceId: 'clinic-1',
    provider: 'NILVERA',
    environment: 'TEST',
    credentials: { provider: 'NILVERA', apiKey: 'test-api-key' },
  };

  const make = () => {
    const client = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    } as unknown as NilveraHttpClient;
    return { adapter: new NilveraEInvoiceAdapter(client), client };
  };

  it('e-Faturayı resmî model gönderim ucuna map eder', async () => {
    const { adapter, client } = make();
    (client.post as jest.Mock).mockResolvedValue({
      UUID: request.idempotencyKey,
      InvoiceNumber: 'EFT2026000000001',
    });

    const result = await adapter.issue(request, integration);

    expect(client.post).toHaveBeenCalledWith(
      { environment: 'TEST', apiKey: 'test-api-key' },
      '/einvoice/Send/Model',
      expect.objectContaining({
        EInvoice: expect.objectContaining({
          InvoiceInfo: expect.objectContaining({
            UUID: request.idempotencyKey,
            CurrencyCode: 'TRY',
            PayableAmount: 1100,
          }),
          CompanyInfo: expect.objectContaining({
            TaxNumber: '1234567890',
            Name: 'Örnek Klinik',
          }),
          CustomerInfo: expect.objectContaining({
            TaxNumber: '11111111111',
            Name: 'Hasta Adı',
          }),
          InvoiceLines: [
            expect.objectContaining({
              Name: 'Muayene',
              Price: 1000,
              KDVPercent: 10,
              KDVTotal: 100,
            }),
          ],
        }),
        CustomerAlias: 'urn:mail:defaultpk@hasta.example',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        documentType: EDocumentTypeSchema.enum.E_FATURA,
        uuid: request.idempotencyKey,
        invoiceNumber: 'EFT2026000000001',
        status: EDocumentStatusSchema.enum.SENT,
      })
    );
  });

  it('e-Arşivi ayrı model gönderim ucuna yollar', async () => {
    const { adapter, client } = make();
    (client.post as jest.Mock).mockResolvedValue({
      UUID: request.idempotencyKey,
      InvoiceNumber: 'ARS2026000000001',
    });

    await adapter.issue(
      {
        ...request,
        type: EDocumentTypeSchema.enum.E_ARSIV,
        buyer: { ...request.buyer, alias: null, isEInvoiceUser: false },
      },
      integration
    );

    expect(client.post).toHaveBeenCalledWith(
      { environment: 'TEST', apiKey: 'test-api-key' },
      '/earchive/Send/Model',
      expect.objectContaining({ ArchiveInvoice: expect.any(Object) })
    );
  });

  it('e-Arşiv iptalini doğru uca gönderir', async () => {
    const { adapter, client } = make();
    (client.put as jest.Mock).mockResolvedValue([]);

    await adapter.cancel(
      {
        documentType: EDocumentTypeSchema.enum.E_ARSIV,
        uuid: request.idempotencyKey,
        reason: 'Hatalı tutar',
      },
      integration
    );

    expect(client.put).toHaveBeenCalledWith(
      { environment: 'TEST', apiKey: 'test-api-key' },
      `/earchive/Invoices/${request.idempotencyKey}/Cancel`
    );
  });

  it('e-Fatura için var olmayan otomatik iptal davranışı uydurmaz', async () => {
    const { adapter, client } = make();

    await expect(
      adapter.cancel(
        {
          documentType: EDocumentTypeSchema.enum.E_FATURA,
          uuid: request.idempotencyKey,
          reason: 'Hatalı tutar',
        },
        integration
      )
    ).rejects.toThrow('yalnız E_ARSIV');
    expect(client.put).not.toHaveBeenCalled();
  });

  it.each([
    ['waiting', EDocumentStatusSchema.enum.QUEUED],
    ['succeed', EDocumentStatusSchema.enum.SENT],
    ['error', EDocumentStatusSchema.enum.FAILED],
  ])('Nilvera durumunu map eder: %s', async (raw, expected) => {
    const { adapter, client } = make();
    (client.get as jest.Mock).mockResolvedValue({ StatusCode: raw });

    await expect(
      adapter.getStatus(
        {
          documentType: EDocumentTypeSchema.enum.E_ARSIV,
          uuid: request.idempotencyKey,
        },
        integration
      )
    ).resolves.toBe(expected);
  });

  it('mükellef bulunamazsa e-Fatura kullanıcısı değildir', async () => {
    const { adapter, client } = make();
    (client.get as jest.Mock).mockRejectedValueOnce(
      new NilveraApiError('bulunamadı', 404, null)
    );

    await expect(
      adapter.checkMailbox('11111111111', integration)
    ).resolves.toEqual({
      isEInvoiceUser: false,
    });
  });

  it('mükellef detayındaki posta kutusu etiketini döndürür', async () => {
    const { adapter, client } = make();
    (client.get as jest.Mock)
      .mockResolvedValueOnce({ TaxNumber: '1234567890' })
      .mockResolvedValueOnce({
        Aliases: [{ Alias: 'urn:mail:defaultpk@firma.example' }],
      });

    await expect(
      adapter.checkMailbox('1234567890', integration)
    ).resolves.toEqual({
      isEInvoiceUser: true,
      alias: 'urn:mail:defaultpk@firma.example',
    });
  });

  it('eksik satıcı vergi kimliğiyle dış çağrı yapmaz', async () => {
    const { adapter, client } = make();

    await expect(
      adapter.issue(
        { ...request, seller: { ...request.seller, taxId: null } },
        integration
      )
    ).rejects.toThrow();
    expect(client.post).not.toHaveBeenCalled();
  });
});
