import { ReceivePurchaseOrderHandler } from './receive-purchase-order.handler';
import { ReceivePurchaseOrderCommand } from './receive-purchase-order.command';
import { PurchaseOrder } from '@modules/supply/purchasing/domain/entities/purchase-order.entity';
import { IPurchaseOrderCommandRepository } from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import { PurchaseOrderNotFoundException } from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import { ReceiveStockCommand } from '@modules/supply/inventory/application/commands/receive-stock/receive-stock.command';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';

describe('ReceivePurchaseOrderHandler — mal kabul (kilit + stok girişi)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';
  const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

  const ctx: IGetContext = {
    actor: {
      userId: 'user-1',
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** Gönderilmiş (SENT) sipariş: tek katalog kalemi, 10 adet. */
  const makeSentOrder = (): PurchaseOrder => {
    const order = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [
        {
          productId: PRODUCT_ID,
          description: 'Eldiven',
          quantity: 10,
          unitPrice: 25,
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

    const dispatched: unknown[] = [];
    const execute = jest.fn((command: unknown) => {
      dispatched.push(command);
      depthAtCall.receiveStock = txDepth;
      return Promise.resolve(undefined);
    });
    const commandBus = { execute } as unknown as TSCommandBus;

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
      handler: new ReceivePurchaseOrderHandler(
        purchaseOrderRepo,
        policyFactory,
        commandBus,
        txManager
      ),
      purchaseOrderRepo,
      findByIdForUpdate,
      update,
      execute,
      dispatched,
      run,
      depthAtCall,
    };
  };

  it('miktarı işler, stok girişini tetikler ve tamamen teslimde RECEIVED olur', async () => {
    const order = makeSentOrder();
    const itemId = order.lines[0].id;
    const { handler, dispatched, update } = build(order);

    await handler.execute(
      new ReceivePurchaseOrderCommand({
        orderId: order.id.value,
        data: { items: [{ itemId, quantity: 10 }] },
        ctx,
      })
    );

    expect(order.status).toBe('RECEIVED');
    expect(order.getLine(itemId)?.quantityReceived.toNumber()).toBe(10);
    expect(update).toHaveBeenCalledTimes(1);

    expect(dispatched[0]).toBeInstanceOf(ReceiveStockCommand);
  });

  it('kabulü giren personel günlüğe yazılır (GRNI dayanağı)', async () => {
    const order = makeSentOrder();
    const itemId = order.lines[0].id;
    const { handler } = build(order);

    await handler.execute(
      new ReceivePurchaseOrderCommand({
        orderId: order.id.value,
        data: { items: [{ itemId, quantity: 3 }] },
        ctx,
      })
    );

    expect(order.pendingReceipts).toHaveLength(1);
    expect(order.pendingReceipts[0].receivedById).toBe('user-1');
    expect(order.pendingReceipts[0].lines[0].quantity.toNumber()).toBe(3);
  });

  it('mal kabulü besleyen okuma kilitli ve stok girişiyle aynı transaction içinde', async () => {
    const order = makeSentOrder();
    const itemId = order.lines[0].id;
    const { handler, purchaseOrderRepo, findByIdForUpdate, run, depthAtCall } =
      build(order);

    await handler.execute(
      new ReceivePurchaseOrderCommand({
        orderId: order.id.value,
        data: { items: [{ itemId, quantity: 4 }] },
        ctx,
      })
    );

    expect(findByIdForUpdate).toHaveBeenCalledWith(order.id.value);
    // Kilitsiz okuma yolu hiç kullanılmaz.
    expect(
      (purchaseOrderRepo as { findById?: unknown }).findById
    ).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    // Sipariş yazması ve stok girişi tek kilit kapsamında → atomik.
    expect(depthAtCall.load).toBe(1);
    expect(depthAtCall.receiveStock).toBe(1);
    expect(order.status).toBe('PARTIALLY_RECEIVED');
  });

  it('sipariş edilenden fazla teslim alınamaz (kilit altında da olsa)', async () => {
    const order = makeSentOrder();
    const itemId = order.lines[0].id;
    const { handler, execute } = build(order);

    await expect(
      handler.execute(
        new ReceivePurchaseOrderCommand({
          orderId: order.id.value,
          data: { items: [{ itemId, quantity: 11 }] },
          ctx,
        })
      )
    ).rejects.toThrow();

    // Fazla kabul reddedildiğinde stok girişi de tetiklenmez.
    expect(execute).not.toHaveBeenCalled();
  });

  it('sipariş yoksa PurchaseOrderNotFoundException', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(
        new ReceivePurchaseOrderCommand({
          orderId: '55555555-5555-4555-8555-555555555555',
          data: { items: [] },
          ctx,
        })
      )
    ).rejects.toBeInstanceOf(PurchaseOrderNotFoundException);
  });
});
