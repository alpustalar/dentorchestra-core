import { ApplyInvoiceToPurchaseOrderHandler } from './apply-invoice-to-purchase-order.handler';
import { ApplyInvoiceToPurchaseOrderCommand } from './apply-invoice-to-purchase-order.command';
import { PurchaseOrder } from '@modules/supply/purchasing/domain/entities/purchase-order.entity';
import { IPurchaseOrderCommandRepository } from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  PurchaseOrderClinicMismatchException,
  PurchaseOrderCurrencyMismatchException,
  PurchaseOrderNotFoundException,
  PurchaseOrderSupplierMismatchException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import CurrencySchema from '@input-type-schemas/CurrencySchema';

describe('ApplyInvoiceToPurchaseOrderHandler — fatura eşleştirme (kilit + uyum)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';
  const OTHER_ID = '55555555-5555-4555-8555-555555555555';
  const INVOICE_ID = '66666666-6666-4666-8666-666666666666';

  const ctx: IGetContext = {
    actor: {
      userId: 'user-1',
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** 1200 TL'lik (10 × 100 + %20) gönderilmiş sipariş. */
  const makeSentOrder = (): PurchaseOrder => {
    const order = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [
        {
          description: 'Eldiven',
          quantity: 10,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
    });
    order.send();
    return order;
  };

  const build = (order: PurchaseOrder | null) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    const findByIdForUpdate = jest.fn(() => {
      depthAtCall.load = txDepth;
      return Promise.resolve(order);
    });
    const update = jest.fn((e: PurchaseOrder) => Promise.resolve(e));

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const purchaseOrderRepo = {
      findByIdForUpdate,
      update,
    } as unknown as IPurchaseOrderCommandRepository;

    const policyFactory = {
      purchasing: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as never;

    const run = jest.fn(async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
    });
    const txManager = { run } as unknown as TransactionManager;

    return {
      handler: new ApplyInvoiceToPurchaseOrderHandler(
        purchaseOrderRepo,
        policyFactory,
        txManager
      ),
      purchaseOrderRepo,
      findByIdForUpdate,
      update,
      depthAtCall,
    };
  };

  const commandFor = (
    order: PurchaseOrder,
    overrides: Partial<{
      clinicId: string;
      supplierId: string;
      grandTotal: string;
      currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
    }> = {}
  ) =>
    new ApplyInvoiceToPurchaseOrderCommand({
      orderId: order.id.value,
      invoiceId: INVOICE_ID,
      clinicId: overrides.clinicId ?? CLINIC_ID,
      supplierId: overrides.supplierId ?? SUPPLIER_ID,
      grandTotal: overrides.grandTotal ?? '1200.00',
      currency: overrides.currency ?? CurrencySchema.enum.TRY,
      ctx,
    });

  it('faturayı siparişe işler ve durumu günceller', async () => {
    const order = makeSentOrder();
    const { handler, update } = build(order);

    await handler.execute(commandFor(order, { grandTotal: '480.00' }));

    expect(order.invoicedTotal.toNumber()).toBe(480);
    expect(order.billingStatus).toBe('PARTIALLY_BILLED');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('sayaç okuması kilitli yapılır (eşzamanlı iki fatura sıraya girsin)', async () => {
    const order = makeSentOrder();
    const { handler, purchaseOrderRepo, findByIdForUpdate, depthAtCall } =
      build(order);

    await handler.execute(commandFor(order, { grandTotal: '100.00' }));

    expect(findByIdForUpdate).toHaveBeenCalledWith(order.id.value);
    expect(
      (purchaseOrderRepo as { findById?: unknown }).findById
    ).toBeUndefined();
    expect(depthAtCall.load).toBe(1);
  });

  it('farklı tedarikçinin faturası eşleştirilemez', async () => {
    const order = makeSentOrder();
    const { handler, update } = build(order);

    await expect(
      handler.execute(commandFor(order, { supplierId: OTHER_ID }))
    ).rejects.toBeInstanceOf(PurchaseOrderSupplierMismatchException);

    expect(update).not.toHaveBeenCalled();
  });

  it('farklı kliniğin faturası eşleştirilemez', async () => {
    const order = makeSentOrder();
    const { handler } = build(order);

    await expect(
      handler.execute(commandFor(order, { clinicId: OTHER_ID }))
    ).rejects.toBeInstanceOf(PurchaseOrderClinicMismatchException);
  });

  it('para birimi farklıysa eşleştirilemez (kur çevrimi sessizce yapılmaz)', async () => {
    const order = makeSentOrder();
    const { handler } = build(order);

    await expect(
      handler.execute(commandFor(order, { currency: 'EUR' }))
    ).rejects.toBeInstanceOf(PurchaseOrderCurrencyMismatchException);
  });

  it('sipariş yoksa PurchaseOrderNotFoundException', async () => {
    const order = makeSentOrder();
    const { handler } = build(null);

    await expect(handler.execute(commandFor(order))).rejects.toBeInstanceOf(
      PurchaseOrderNotFoundException
    );
  });
});
