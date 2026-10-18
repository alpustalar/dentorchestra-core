/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { RecordPurchaseInvoiceHandler } from './record-purchase-invoice.handler';
import { RecordPurchaseInvoiceCommand } from './record-purchase-invoice.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import { ApplyInvoiceToPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/apply-invoice-to-purchase-order/apply-invoice-to-purchase-order.command';
import { PurchaseInvoiceDuplicateException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import type { RecordPurchaseInvoice } from '@shared/modules/purchase-invoice/types/commands';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';

describe('RecordPurchaseInvoiceHandler', () => {
  const clinicId = UUID.generate().value;
  const supplierId = UUID.generate().value;
  const organizationId = UUID.generate().value;

  const ctx = {
    actor: { userId: 'user-1', source: LogSource.WEB, clinicId },
    source: 'USER_ACTION',
  } as never;

  const data = (
    overrides: Partial<RecordPurchaseInvoice> = {}
  ): RecordPurchaseInvoice =>
    ({
      clinicId,
      supplierId,
      supplierName: 'Tedarikçi A.Ş.',
      invoiceNumber: 'TDR-2026-001',
      invoiceDate: new Date('2026-05-01'),
      lineAccountCode: '770',
      vatRate: 20,
      netTotal: 1000,
      vatTotal: 200,
      currency: 'TRY',
      ...overrides,
    }) as RecordPurchaseInvoice;

  const make = (options: { periodSealed?: boolean } = {}) => {
    const purchaseInvoiceCommandRepo = {
      create: jest.fn(async (entity: unknown) => entity),
      update: jest.fn(),
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
    };
    const policyFactory = {
      clinic: () => ({
        evaluator: { check: () => ({ orThrow: () => undefined }) },
      }),
    };
    const tenantScopeResolver = {
      resolve: jest.fn().mockResolvedValue(organizationId),
    };
    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    };
    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        if (cmd instanceof EnsurePartyCommand) return 'party-1';
        return undefined;
      }),
    };

    const periodGate = {
      assertPeriodNotSealedAt: jest.fn(async () => {
        if (options.periodSealed) {
          throw new PeriodSealedForDateException({
            clinicId,
            date: new Date('2025-03-01'),
            year: 2025,
            currentStatus: 'CLOSED',
          });
        }
      }),
    };

    const handler = new RecordPurchaseInvoiceHandler(
      purchaseInvoiceCommandRepo as never,
      policyFactory as never,
      tenantScopeResolver as never,
      periodGate as never,
      txManager as never,
      commandBus as never
    );

    return {
      handler,
      purchaseInvoiceCommandRepo,
      txManager,
      commandBus,
      tenantScopeResolver,
      periodGate,
    };
  };

  it('belgeyi kaydeder ve muhasebe köprüsünü aynı transaction içinde çalıştırır', async () => {
    const { handler, purchaseInvoiceCommandRepo, txManager, commandBus } =
      make();

    const id = await handler.execute(
      new RecordPurchaseInvoiceCommand(data(), ctx)
    );

    expect(UUID.create(id).instance).toBeDefined();
    expect(txManager.outboxRun).toHaveBeenCalledTimes(1);
    expect(purchaseInvoiceCommandRepo.create).toHaveBeenCalledTimes(1);

    const eventCall = commandBus.execute.mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );
    expect(eventCall).toBeDefined();
  });

  // --- §13 P0-3: para birimi olaya geçer ---

  it("ekonomik olay payload'ında faturanın para birimi bulunur", async () => {
    const { handler, commandBus } = make();

    await handler.execute(
      new RecordPurchaseInvoiceCommand(data({ currency: 'USD' }), ctx)
    );

    const call = commandBus.execute.mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );
    const cmd = call![0] as RecordFinancialEventCommand;
    // Eksik bırakılırsa posting defterin fonksiyonel parasını (TRY) varsayar:
    // 1.200 USD'lik ithal fatura deftere 1.200 TRY borç olarak düşerdi.
    expect((cmd.data.payload as { currency?: string }).currency).toBe('USD');
    expect((cmd.data.payload as { grandTotal?: string }).grandTotal).toBe(
      '1200.00'
    );
  });

  // --- §13 P1-5: aktör izi ---

  it("köprü çağrıları gerçek aktörün ctx'iyle yapılır (internal değil)", async () => {
    const { handler, commandBus } = make();

    await handler.execute(new RecordPurchaseInvoiceCommand(data(), ctx));

    const partyCall = commandBus.execute.mock.calls.find(
      ([c]) => c instanceof EnsurePartyCommand
    );
    const eventCall = commandBus.execute.mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );

    expect((partyCall![0] as EnsurePartyCommand).ctx).toBe(ctx);
    expect((eventCall![0] as RecordFinancialEventCommand).ctx).toBe(ctx);
  });

  // --- §13 P0-2: köprü hatası yutulmaz ---

  it('muhasebe köprüsü patlarsa hata yükselir (fatura kaydı da geri sarılır)', async () => {
    const { handler, commandBus } = make();
    commandBus.execute.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof EnsurePartyCommand) return 'party-1';
      if (cmd instanceof RecordFinancialEventCommand) {
        throw new Error('financial event yazılamadı');
      }
      return undefined;
    });

    // Yutulduğunda alış faturası kaydedilip 320 Satıcılar borcu hiç yazılmıyordu
    // ve olay hiç yazılmadığı için mutabakat süpürmesi de bunu göremiyordu.
    await expect(
      handler.execute(new RecordPurchaseInvoiceCommand(data(), ctx))
    ).rejects.toThrow('financial event yazılamadı');
  });

  it('mükerrer belge hatası (doğal anahtar) yutulmaz', async () => {
    const { handler, purchaseInvoiceCommandRepo } = make();
    purchaseInvoiceCommandRepo.create.mockRejectedValue(
      new PurchaseInvoiceDuplicateException()
    );

    await expect(
      handler.execute(new RecordPurchaseInvoiceCommand(data(), ctx))
    ).rejects.toThrow(PurchaseInvoiceDuplicateException);
  });

  it('sipariş verildiyse eşleştirme köprüden ÖNCE ve aynı transaction içinde çalışır', async () => {
    const { handler, commandBus } = make();
    const purchaseOrderId = UUID.generate().value;

    await handler.execute(
      new RecordPurchaseInvoiceCommand(data({ purchaseOrderId }), ctx)
    );

    const order = commandBus.execute.mock.calls.findIndex(
      ([c]) => c instanceof ApplyInvoiceToPurchaseOrderCommand
    );
    const event = commandBus.execute.mock.calls.findIndex(
      ([c]) => c instanceof RecordFinancialEventCommand
    );

    expect(order).toBeGreaterThanOrEqual(0);
    expect(order).toBeLessThan(event);
  });

  it('fatura tarihi mühürlenmiş döneme düşüyorsa belge hiç yazılmaz', async () => {
    // Kabul edilse belge yazılır, 320 borcu için olay da yazılır ama fişi hiç
    // üretilemezdi (posting dönem kapısı reddeder) ve olay append-only olduğu
    // için tarih düzeltilemezdi: mizan kalıcı eksik kalır.
    const { handler, purchaseInvoiceCommandRepo, commandBus } = make({
      periodSealed: true,
    });

    await expect(
      handler.execute(
        new RecordPurchaseInvoiceCommand(
          data({ invoiceDate: new Date('2025-03-01') }),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(PeriodSealedForDateException);

    expect(purchaseInvoiceCommandRepo.create).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
