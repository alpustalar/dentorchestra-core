import { Invoice } from './invoice.entity';
import { InvoiceIssuedEvent } from '@modules/finance/invoice/domain/events/invoice-issued.event';
import { InvoiceFailedEvent } from '@modules/finance/invoice/domain/events/invoice-failed.event';
import { InvoiceCancelledEvent } from '@modules/finance/invoice/domain/events/invoice-cancelled.event';
import {
  InvoiceAlreadyCancelledException,
  InvoiceEDocumentDispatchInFlightException,
  InvoiceNotFinalizableException,
  InvoiceNumberImmutableException,
  InvoiceNumberInvalidException,
} from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { Invoice as IInvoice } from '@model-schema/InvoiceSchema';
import { Decimal } from 'decimal.js';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';

/**
 * Faturanın belge yaşam döngüsü (§12 P0-3, P1-1, P1-3): e-Belge sonucu uygulanırken
 * belge donar (numara değişmez, iptal edilmiş fatura dirilmez) ve finalizasyon
 * audit izi bırakır.
 */
describe('Invoice (e-Belge sonucu / belge değişmezliği)', () => {
  const row = (overrides: Partial<IInvoice> = {}): IInvoice =>
    ({
      id: UUID.generate().value,
      organizationId: UUID.generate().value,
      clinicId: UUID.generate().value,
      patientId: UUID.generate().value,
      appointmentId: null,
      paymentId: null,
      amount: new Decimal('1100.00'),
      currency: 'TRY',
      vatRate: 10,
      netTotal: new Decimal('1000.00'),
      vatTotal: new Decimal('100.00'),
      status: InvoiceStatusSchema.enum.PENDING,
      invoiceNumber: null,
      issuedAt: null,
      documentType: null,
      einvoiceUuid: null,
      einvoiceStatus: EDocumentStatusSchema.enum.DRAFT,
      providerRef: null,
      rawResponse: null,
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-01'),
      isDeleted: false,
      ...overrides,
    }) as IInvoice;

  const result = (invoiceNumber: string | null = 'ABC2026000000001') => ({
    documentType: EDocumentTypeSchema.enum.E_ARSIV,
    uuid: UUID.generate().value,
    status: EDocumentStatusSchema.enum.ACCEPTED,
    invoiceNumber,
  });

  it('PENDING fatura ISSUED olur ve kesim olayı fırlatılır', () => {
    const invoice = new Invoice(row());

    invoice.applyEDocumentResult(result());

    expect(invoice.status).toBe(InvoiceStatusSchema.enum.ISSUED);
    expect(invoice.issuedAt).not.toBeNull();
    expect(invoice.invoiceNumber?.value).toBe('ABC2026000000001');

    const events = invoice.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(InvoiceIssuedEvent);
    expect((events[0] as InvoiceIssuedEvent).invoiceNumber).toBe(
      'ABC2026000000001'
    );
  });

  it('entegratör sonucu REJECTED olsa bile fatura finalize edilir (e-belge muhasebeden bağımsız)', () => {
    const invoice = new Invoice(row());

    invoice.applyEDocumentResult({
      ...result(null),
      status: EDocumentStatusSchema.enum.REJECTED,
    });

    expect(invoice.status).toBe(InvoiceStatusSchema.enum.ISSUED);
    expect(invoice.einvoiceStatus).toBe(EDocumentStatusSchema.enum.REJECTED);
  });

  // --- P1-1: belge numarası değişmez ---

  it('kesilmiş faturanın numarası ikinci bir sonuçla DEĞİŞTİRİLEMEZ', () => {
    const invoice = new Invoice(
      row({
        status: InvoiceStatusSchema.enum.ISSUED,
        invoiceNumber: 'ABC2026000000001',
        issuedAt: new Date('2026-05-02'),
        einvoiceStatus: EDocumentStatusSchema.enum.ACCEPTED,
      })
    );

    // Job retry senaryosu: entegratör ikinci bir belge numarası döndürdü.
    expect(() =>
      invoice.applyEDocumentResult(result('XYZ2026000000009'))
    ).toThrow(InvoiceNumberImmutableException);

    expect(invoice.invoiceNumber?.value).toBe('ABC2026000000001');
  });

  it('aynı numara yeniden gelirse hata vermez (idempotent)', () => {
    const invoice = new Invoice(
      row({
        status: InvoiceStatusSchema.enum.ISSUED,
        invoiceNumber: 'ABC2026000000001',
        issuedAt: new Date('2026-05-02'),
      })
    );

    expect(() =>
      invoice.applyEDocumentResult(result('ABC2026000000001'))
    ).not.toThrow();
    // Zaten ISSUED olduğu için ikinci bir kesim olayı üretilmez.
    expect(invoice.getDomainEvents()).toHaveLength(0);
  });

  it('iptal edilmiş fatura e-belge sonucuyla diriltilemez', () => {
    const invoice = new Invoice(
      row({ status: InvoiceStatusSchema.enum.CANCELLED })
    );

    expect(() => invoice.applyEDocumentResult(result())).toThrow(
      InvoiceNotFinalizableException
    );
  });

  it('GİB biçimine uymayan numara tipli domain hatası verir (HTTP exception değil)', () => {
    const invoice = new Invoice(row());

    expect(() => invoice.applyEDocumentResult(result('123'))).toThrow(
      InvoiceNumberInvalidException
    );
  });

  // --- P1-3: gönderim hatası izi ---

  it('e-belge gönderimi başarısızsa faturanın durumu değişmez, yalnız e-belge durumu FAILED olur', () => {
    const invoice = new Invoice(row());

    invoice.markEDocumentFailed({ reason: 'entegratör 503' });

    // Hasılat/KDV zaten muhasebeleşti; faturayı FAILED ilan etmek defteri yalanlardı.
    expect(invoice.status).toBe(InvoiceStatusSchema.enum.PENDING);
    expect(invoice.einvoiceStatus).toBe(EDocumentStatusSchema.enum.FAILED);

    const events = invoice.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(InvoiceFailedEvent);
    expect((events[0] as InvoiceFailedEvent).reason).toBe('entegratör 503');
  });

  it('toPersistence para alanlarını ve e-belge izini taşır', () => {
    const invoice = new Invoice(row());

    invoice.applyEDocumentResult({
      ...result(),
      providerRef: 'NILVERA-123',
      rawResponse: { ok: true },
    });

    const persisted = invoice.toPersistence();
    expect(persisted.netTotal.toString()).toBe('1000');
    expect(persisted.vatTotal.toString()).toBe('100');
    expect(persisted.amount.toString()).toBe('1100');
    expect(persisted.vatRate).toBe(10);
    expect(persisted.providerRef).toBe('NILVERA-123');
    expect(persisted.einvoiceStatus).toBe(EDocumentStatusSchema.enum.ACCEPTED);
    expect(persisted.status).toBe(InvoiceStatusSchema.enum.ISSUED);
  });
});

/**
 * Fatura iptali (storno). Belge yerinde kalır, CANCELLED damgalanır ve kalıcı
 * iz (kim/ne zaman/neden) bırakır; defter etkisini ters kayıt götürür.
 */
describe('Invoice.cancel (iptal / storno)', () => {
  const row = (overrides: Partial<IInvoice> = {}): IInvoice =>
    ({
      id: UUID.generate().value,
      organizationId: UUID.generate().value,
      clinicId: UUID.generate().value,
      patientId: UUID.generate().value,
      appointmentId: null,
      paymentId: null,
      amount: new Decimal('1100.00'),
      currency: 'TRY',
      vatRate: 10,
      netTotal: new Decimal('1000.00'),
      vatTotal: new Decimal('100.00'),
      status: InvoiceStatusSchema.enum.ISSUED,
      invoiceNumber: 'ABC2026000000001',
      issuedAt: new Date('2026-05-01'),
      documentType: EDocumentTypeSchema.enum.E_ARSIV,
      einvoiceUuid: null,
      einvoiceStatus: EDocumentStatusSchema.enum.INTERNAL,
      providerRef: null,
      rawResponse: null,
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-01'),
      isDeleted: false,
      ...overrides,
    }) as IInvoice;

  const props = {
    reason: 'Tutar hatalı girildi',
    cancelledById: 'firebase-uid-1',
  };

  it('CANCELLED yapar, kalıcı damgayı yazar ve iptal olayını fırlatır', () => {
    const invoice = new Invoice(row());

    invoice.cancel(props);

    expect(invoice.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
    expect(invoice.isCancelled()).toBe(true);
    expect(invoice.cancelledAt).toBeInstanceOf(Date);
    expect(invoice.cancelledById).toBe('firebase-uid-1');
    expect(invoice.cancelReason).toBe('Tutar hatalı girildi');

    const events = invoice.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(InvoiceCancelledEvent);
  });

  it('belge numarası yakılır: iptalde silinmez (iz kalır)', () => {
    const invoice = new Invoice(row());

    invoice.cancel(props);

    expect(invoice.invoiceNumber?.value).toBe('ABC2026000000001');
    expect(invoice.toPersistence().invoiceNumber).toBe('ABC2026000000001');
  });

  it('ikinci iptal reddedilir (mükerrer storno defteri ters işarete çeker)', () => {
    const invoice = new Invoice(row());
    invoice.cancel(props);

    expect(() => invoice.cancel(props)).toThrow(
      InvoiceAlreadyCancelledException
    );
  });

  it('zaten CANCELLED kayıt da reddedilir (yeniden yüklenmiş fatura)', () => {
    const invoice = new Invoice(
      row({
        status: InvoiceStatusSchema.enum.CANCELLED,
        cancelledAt: new Date('2026-05-02'),
      })
    );

    expect(() => invoice.cancel(props)).toThrow(
      InvoiceAlreadyCancelledException
    );
  });

  it('e-belge gönderimi havadaysa (QUEUED) iptal reddedilir', () => {
    const invoice = new Invoice(
      row({ einvoiceStatus: EDocumentStatusSchema.enum.QUEUED })
    );

    expect(() => invoice.cancel(props)).toThrow(
      InvoiceEDocumentDispatchInFlightException
    );
    expect(invoice.status).toBe(InvoiceStatusSchema.enum.ISSUED);
  });

  it('gönderilmiş belge (SENT) iptal EDİLEBİLİR — entegratör bildirimi ayrı adım', () => {
    const invoice = new Invoice(
      row({
        einvoiceStatus: EDocumentStatusSchema.enum.SENT,
        einvoiceUuid: UUID.generate().value,
      })
    );

    invoice.cancel(props);

    expect(invoice.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
    expect(invoice.einvoiceUuid).not.toBeNull();
  });

  it('tahsilatı olan fatura iptal EDİLEBİLİR (iade ayrı akış)', () => {
    const invoice = new Invoice(row({ paymentId: UUID.generate().value }));

    invoice.cancel(props);

    expect(invoice.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
    expect(invoice.paymentId).not.toBeNull();
  });

  it('iptal edilmiş fatura e-belge sonucuyla dirilmez', () => {
    const invoice = new Invoice(row());
    invoice.cancel(props);

    expect(() =>
      invoice.applyEDocumentResult({
        documentType: EDocumentTypeSchema.enum.E_ARSIV,
        uuid: UUID.generate().value,
        status: EDocumentStatusSchema.enum.ACCEPTED,
      })
    ).toThrow(InvoiceNotFinalizableException);
  });
});
