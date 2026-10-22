/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { CancelInvoiceHandler } from './cancel-invoice.handler';
import { CancelInvoiceCommand } from './cancel-invoice.command';
import { Invoice } from '@modules/finance/invoice/domain/entities/invoice.entity';
import { Invoice as IInvoice } from '@model-schema/InvoiceSchema';
import {
  InvoiceAlreadyCancelledException,
  InvoiceEDocumentDispatchInFlightException,
  InvoiceNotFoundException,
} from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { ReverseJournalEntryByEventCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry-by-event/reverse-journal-entry-by-event.command';
import { QueueEDocumentCancelCommand } from '@modules/finance/e-document/application/commands/queue-e-document-cancel/queue-e-document-cancel.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Decimal } from 'decimal.js';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';

describe('CancelInvoiceHandler', () => {
  const clinicId = UUID.generate().value;

  const ctx = {
    actor: { userId: 'firebase-uid-1', source: LogSource.WEB, clinicId },
    source: 'USER_ACTION',
  } as never;

  const row = (overrides: Partial<IInvoice> = {}): IInvoice =>
    ({
      id: UUID.generate().value,
      organizationId: UUID.generate().value,
      clinicId,
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
      documentType: EDocumentTypeSchema.enum.INTERNAL,
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

  const make = (invoice: Invoice | null) => {
    const invoiceRepo = {
      findByIdForUpdate: jest.fn(async () => invoice),
      update: jest.fn(async (entity: unknown) => entity),
      create: jest.fn(),
      findById: jest.fn(),
      findByAppointmentId: jest.fn(),
      findByPaymentId: jest.fn(),
      claimForEDocumentDispatch: jest.fn(),
    };
    const policyFactory = {
      finance: () => ({
        evaluator: { check: () => ({ orThrow: () => undefined }) },
      }),
    };
    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    };
    const commandBus = {
      // Dönüş komuta göre: storno fiş id'si döner, kuyruğa alma void.
      execute: jest.fn(async (cmd: unknown) =>
        cmd instanceof ReverseJournalEntryByEventCommand
          ? 'reversal-1'
          : undefined
      ),
    };

    const handler = new CancelInvoiceHandler(
      invoiceRepo as never,
      policyFactory as never,
      txManager as never,
      commandBus as never
    );

    return { handler, invoiceRepo, txManager, commandBus };
  };

  const run = (handler: CancelInvoiceHandler, invoiceId: string) =>
    handler.execute(
      new CancelInvoiceCommand({
        invoiceId,
        data: { reason: 'Tutar hatalı girildi' },
        ctx,
      })
    );

  const commandsOf = (commandBus: { execute: jest.Mock }) =>
    commandBus.execute.mock.calls.map(([cmd]) => cmd as unknown);

  it('faturayı kilitli okur, iptal eder ve stornoyu aynı tx içinde atar', async () => {
    const invoice = new Invoice(row());
    const { handler, invoiceRepo, txManager, commandBus } = make(invoice);

    await run(handler, invoice.id.value);

    expect(txManager.outboxRun).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.findByIdForUpdate).toHaveBeenCalledWith(
      invoice.id.value
    );
    expect(invoice.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
    expect(invoiceRepo.update).toHaveBeenCalledWith(invoice);

    const storno = commandsOf(commandBus).find(
      (cmd): cmd is ReverseJournalEntryByEventCommand =>
        cmd instanceof ReverseJournalEntryByEventCommand
    );
    expect(storno?.payload.dedupeKey).toBe(
      FinancialEventDedupeKeys.sales_invoice(invoice.id.value)
    );
  });

  it('iç belge (INTERNAL) için entegratör iptali kuyruğa alınmaz', async () => {
    const invoice = new Invoice(row());
    const { handler, commandBus } = make(invoice);

    await run(handler, invoice.id.value);

    const queued = commandsOf(commandBus).filter(
      (cmd) => cmd instanceof QueueEDocumentCancelCommand
    );
    expect(queued).toHaveLength(0);
  });

  it('gönderilmiş belge (SENT + uuid) için entegratör iptali kuyruğa alınır', async () => {
    const einvoiceUuid = UUID.generate().value;
    const invoice = new Invoice(
      row({
        einvoiceStatus: EDocumentStatusSchema.enum.SENT,
        einvoiceUuid,
        documentType: EDocumentTypeSchema.enum.E_FATURA,
      })
    );
    const { handler, commandBus } = make(invoice);

    await run(handler, invoice.id.value);

    const queued = commandsOf(commandBus).find(
      (cmd): cmd is QueueEDocumentCancelCommand =>
        cmd instanceof QueueEDocumentCancelCommand
    );
    expect(queued?.payload).toEqual({
      invoiceId: invoice.id.value,
      documentType: EDocumentTypeSchema.enum.E_FATURA,
      uuid: einvoiceUuid,
      reason: 'Tutar hatalı girildi',
      clinicId,
    });
  });

  it('kuyruğa alma hatası iptali geri ALMAZ (commit edilmiş iş korunur)', async () => {
    const invoice = new Invoice(
      row({
        einvoiceStatus: EDocumentStatusSchema.enum.ACCEPTED,
        einvoiceUuid: UUID.generate().value,
      })
    );
    const { handler, commandBus } = make(invoice);
    commandBus.execute.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof QueueEDocumentCancelCommand) {
        throw new Error('redis yok');
      }
      return 'reversal-1';
    });

    await expect(run(handler, invoice.id.value)).resolves.toBeUndefined();
    expect(invoice.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
  });

  it('storno hatası YUTULMAZ (iptal ile defter birlikte geri sarılır)', async () => {
    const invoice = new Invoice(row());
    const { handler, commandBus } = make(invoice);
    commandBus.execute.mockRejectedValueOnce(new Error('olay fişlenmedi'));

    await expect(run(handler, invoice.id.value)).rejects.toThrow(
      'olay fişlenmedi'
    );
  });

  it('e-belge gönderimi havadaysa (QUEUED) iptal reddedilir ve storno atılmaz', async () => {
    const invoice = new Invoice(
      row({ einvoiceStatus: EDocumentStatusSchema.enum.QUEUED })
    );
    const { handler, commandBus } = make(invoice);

    await expect(run(handler, invoice.id.value)).rejects.toThrow(
      InvoiceEDocumentDispatchInFlightException
    );
    expect(commandsOf(commandBus)).toHaveLength(0);
  });

  it('zaten iptal edilmiş fatura ikinci kez iptal edilemez', async () => {
    const invoice = new Invoice(
      row({
        status: InvoiceStatusSchema.enum.CANCELLED,
        cancelledAt: new Date('2026-05-02'),
      })
    );
    const { handler, commandBus } = make(invoice);

    await expect(run(handler, invoice.id.value)).rejects.toThrow(
      InvoiceAlreadyCancelledException
    );
    expect(commandsOf(commandBus)).toHaveLength(0);
  });

  it('fatura yoksa hata fırlatır', async () => {
    const { handler } = make(null);

    await expect(run(handler, UUID.generate().value)).rejects.toThrow(
      InvoiceNotFoundException
    );
  });
});
