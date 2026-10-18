import { NoopEInvoiceAdapter } from './noop-e-invoice.adapter';
import { EInvoicePort } from '@modules/finance/e-document/domain/ports/e-invoice.port';
import { EDocumentRequest } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';

describe('NoopEInvoiceAdapter (entegratör kapalı fallback, doc 07 §1)', () => {
  // Port kontratı üzerinden test: çağıranlar EInvoicePort imzasıyla çağırır.
  const adapter: EInvoicePort = new NoopEInvoiceAdapter();

  const request: EDocumentRequest = {
    type: EDocumentTypeSchema.enum.E_ARSIV,
    invoiceId: 'inv-1',
    idempotencyKey: 'inv-1',
    issueDate: new Date('2026-06-18'),
    seller: { taxId: '1234567890', name: '' },
    buyer: { taxId: '11111111111', name: 'Hasta', isEInvoiceUser: false },
    lines: [
      {
        name: 'Hizmet bedeli',
        quantity: 1,
        unitPrice: '1000.00',
        vatRate: 10,
        vatAmount: '100.00',
      },
    ],
    totals: { net: '1000.00', vat: '100.00', payable: '1100.00' },
    currency: 'TRY',
  };

  it('issue → INTERNAL belge döner, hata FIRLATMAZ (çözülen tür ne olursa olsun)', async () => {
    const result = await adapter.issue(request);

    expect(result.documentType).toBe(EDocumentTypeSchema.enum.INTERNAL);
    expect(result.status).toBe(EDocumentStatusSchema.enum.INTERNAL);
    expect(result.uuid).toBeNull();
    expect(result.invoiceNumber).toBeNull();
  });

  it('cancel / getStatus / checkMailbox güvenli default döner', async () => {
    await expect(adapter.cancel('uuid-1', 'neden')).resolves.toBeUndefined();
    await expect(adapter.getStatus('uuid-1')).resolves.toBe(
      EDocumentStatusSchema.enum.INTERNAL
    );
    await expect(adapter.checkMailbox('1234567890')).resolves.toEqual({
      isEInvoiceUser: false,
    });
  });
});
