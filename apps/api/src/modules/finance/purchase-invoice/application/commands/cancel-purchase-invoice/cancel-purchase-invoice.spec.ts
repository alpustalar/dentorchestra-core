/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { CancelPurchaseInvoiceHandler } from './cancel-purchase-invoice.handler';
import { CancelPurchaseInvoiceCommand } from './cancel-purchase-invoice.command';
import { PurchaseInvoice } from '@modules/finance/purchase-invoice/domain/entities/purchase-invoice.entity';
import { PurchaseInvoiceNotFoundException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import { ReverseJournalEntryByEventCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry-by-event/reverse-journal-entry-by-event.command';
import { RevertInvoiceFromPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/revert-invoice-from-purchase-order/revert-invoice-from-purchase-order.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';

describe('CancelPurchaseInvoiceHandler', () => {
  const clinicId = UUID.generate().value;
  const organizationId = UUID.generate().value;
  const supplierId = UUID.generate().value;

  const ctx = {
    actor: { userId: 'firebase-uid-1', source: LogSource.WEB, clinicId },
    source: 'USER_ACTION',
  } as never;

  const invoiceOf = (purchaseOrderId: string | null = null) =>
    PurchaseInvoice.create({
      id: UUID.generate().value,
      clinicId,
      organizationId,
      supplierId,
      invoiceNumber: 'TDR-2026-500',
      invoiceDate: new Date('2026-05-01'),
      lineAccountCode: '150',
      purchaseOrderId,
      vatRate: 20,
      netTotal: '1000.00',
      vatTotal: '200.00',
      grandTotal: '1200.00',
      currency: 'TRY',
    });

  const make = (invoice: PurchaseInvoice | null) => {
    const purchaseInvoiceCommandRepo = {
      findByIdForUpdate: jest.fn(async () => invoice),
      update: jest.fn(async (entity: unknown) => entity),
      create: jest.fn(),
      findById: jest.fn(),
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
      // Dönüş komuta göre: storno fiş id'si döner, sipariş sayacı void.
      execute: jest.fn(async (cmd: unknown) =>
        cmd instanceof ReverseJournalEntryByEventCommand
          ? 'reversal-1'
          : undefined
      ),
    };

    const handler = new CancelPurchaseInvoiceHandler(
      purchaseInvoiceCommandRepo as never,
      policyFactory as never,
      txManager as never,
      commandBus as never
    );

    return { handler, purchaseInvoiceCommandRepo, txManager, commandBus };
  };

  const run = (handler: CancelPurchaseInvoiceHandler, invoiceId: string) =>
    handler.execute(
      new CancelPurchaseInvoiceCommand({
        invoiceId,
        data: { reason: 'Tedarikçi belgeyi iptal etti' },
        ctx,
      })
    );

  it('faturayı kilitli okur, iptal eder ve stornoyu aynı tx içinde atar', async () => {
    const invoice = invoiceOf();
    const { handler, purchaseInvoiceCommandRepo, txManager, commandBus } =
      make(invoice);

    await run(handler, invoice.id.value);

    expect(txManager.outboxRun).toHaveBeenCalledTimes(1);
    expect(purchaseInvoiceCommandRepo.findByIdForUpdate).toHaveBeenCalledWith(
      invoice.id.value
    );
    expect(invoice.status).toBe('CANCELLED');
    expect(purchaseInvoiceCommandRepo.update).toHaveBeenCalledWith(invoice);

    const storno = commandBus.execute.mock.calls
      .map(([cmd]) => cmd)
      .find(
        (cmd): cmd is ReverseJournalEntryByEventCommand =>
          cmd instanceof ReverseJournalEntryByEventCommand
      );
    expect(storno).toBeDefined();
    expect(storno?.payload.dedupeKey).toBe(
      FinancialEventDedupeKeys.purchase_invoice(invoice.id.value)
    );
  });

  it('siparişe bağlı faturada sayaç düşülür (tutar kuruş string olarak)', async () => {
    const orderId = UUID.generate().value;
    const invoice = invoiceOf(orderId);
    const { handler, commandBus } = make(invoice);

    await run(handler, invoice.id.value);

    const revert = commandBus.execute.mock.calls
      .map(([cmd]) => cmd)
      .find(
        (cmd): cmd is RevertInvoiceFromPurchaseOrderCommand =>
          cmd instanceof RevertInvoiceFromPurchaseOrderCommand
      );
    expect(revert).toBeDefined();
    expect(revert?.payload.orderId).toBe(orderId);
    expect(revert?.payload.grandTotal).toBe('1200.00');
  });

  it('serbest faturada sipariş sayacı çağrılmaz', async () => {
    const invoice = invoiceOf(null);
    const { handler, commandBus } = make(invoice);

    await run(handler, invoice.id.value);

    const revert = commandBus.execute.mock.calls
      .map(([cmd]) => cmd)
      .filter((cmd) => cmd instanceof RevertInvoiceFromPurchaseOrderCommand);
    expect(revert).toHaveLength(0);
  });

  it('fatura yoksa hata fırlatır', async () => {
    const { handler } = make(null);

    await expect(run(handler, UUID.generate().value)).rejects.toThrow(
      PurchaseInvoiceNotFoundException
    );
  });

  it('storno hatası YUTULMAZ (her şey geri sarılır)', async () => {
    const invoice = invoiceOf();
    const { handler, commandBus } = make(invoice);
    commandBus.execute.mockRejectedValueOnce(new Error('dönem kapalı'));

    await expect(run(handler, invoice.id.value)).rejects.toThrow(
      'dönem kapalı'
    );
  });
});
