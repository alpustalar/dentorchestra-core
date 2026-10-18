import { CreatePurchaseOrderHandler } from './create-purchase-order.handler';
import { CreatePurchaseOrderCommand } from './create-purchase-order.command';
import { PurchaseRequest } from '@modules/supply/purchasing/domain/entities/purchase-request.entity';
import {
  PurchaseRequestClinicMismatchException,
  PurchaseRequestNotFoundException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import { SupplierNotUsableInClinicException } from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import type { CreatePurchaseOrder } from '@shared/modules/purchasing';

/**
 * Sipariş açma kapısı: tedarikçi/ürün kayıtları FK'siz skaler taşındığı için
 * kiracı ve kullanılabilirlik doğrulaması burada yapılır; kaynak talep de
 * siparişin kliniğine ait olmak zorundadır.
 */
describe('CreatePurchaseOrderHandler — kiracı ve katalog kapısı', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_CLINIC_ID = '99999999-9999-4999-8999-999999999999';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';
  const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
  const REQUEST_ID = '77777777-7777-4777-8777-777777777777';

  const ctx: IGetContext = {
    actor: {
      userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h', // Firebase UID
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const data = (
    overrides: Partial<CreatePurchaseOrder> = {}
  ): CreatePurchaseOrder =>
    ({
      clinicId: CLINIC_ID,
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
      ...overrides,
    }) as CreatePurchaseOrder;

  const makeApprovedRequest = (clinicId: string): PurchaseRequest => {
    const request = PurchaseRequest.create({
      id: REQUEST_ID,
      clinicId,
      organizationId: ORG_ID,
      requestedById: 'zQ7wE1rT5yU8iO2pL4kJ6hA3xY9z',
      items: [{ description: 'Eldiven', quantity: 10 }],
    });
    request.approve('aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h');
    return request;
  };

  const build = (
    options: {
      request?: PurchaseRequest | null;
      supplierUsable?: boolean;
    } = {}
  ) => {
    const orderCreate = jest.fn((order: unknown) => Promise.resolve(order));
    const requestUpdate = jest.fn((r: unknown) => Promise.resolve(r));

    const assertSupplierUsable = jest.fn(() =>
      options.supplierUsable === false
        ? Promise.reject(
            new SupplierNotUsableInClinicException({
              supplierId: SUPPLIER_ID,
              reason: 'OTHER_CLINIC',
            })
          )
        : Promise.resolve()
    );
    const assertProductsUsable = jest.fn(() => Promise.resolve());

    const handler = new CreatePurchaseOrderHandler(
      { create: orderCreate } as never,
      {
        findByIdForUpdate: jest.fn().mockResolvedValue(options.request ?? null),
        update: requestUpdate,
      } as never,
      {
        purchasing: jest.fn().mockReturnValue({
          evaluator: {
            check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
          },
        }),
      } as never,
      { resolve: jest.fn().mockResolvedValue(ORG_ID) } as never,
      { assertSupplierUsable, assertProductsUsable } as never,
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    return {
      handler,
      orderCreate,
      requestUpdate,
      assertSupplierUsable,
      assertProductsUsable,
    };
  };

  it('tedarikçi ve ürünler doğrulandıktan sonra sipariş yazılır', async () => {
    const { handler, orderCreate, assertSupplierUsable, assertProductsUsable } =
      build();

    await handler.execute(new CreatePurchaseOrderCommand(data(), ctx));

    expect(assertSupplierUsable).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      supplierId: SUPPLIER_ID,
    });
    expect(assertProductsUsable).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      productIds: [PRODUCT_ID],
    });
    expect(orderCreate).toHaveBeenCalledTimes(1);
  });

  it('kullanılamaz tedarikçide sipariş hiç yazılmaz', async () => {
    const { handler, orderCreate } = build({ supplierUsable: false });

    await expect(
      handler.execute(new CreatePurchaseOrderCommand(data(), ctx))
    ).rejects.toBeInstanceOf(SupplierNotUsableInClinicException);

    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('katalog-dışı kalemde ürün doğrulaması çağrılmaz', async () => {
    const { handler, assertProductsUsable } = build();

    await handler.execute(
      new CreatePurchaseOrderCommand(
        data({
          items: [{ description: 'Serbest kalem', quantity: 1, unitPrice: 10 }],
        }),
        ctx
      )
    );

    expect(assertProductsUsable).not.toHaveBeenCalled();
  });

  it('başka kliniğin talebi siparişe bağlanamaz — talep ORDERED yapılmaz', async () => {
    // Yetki kontrolü `data.clinicId` üzerinden yapılıyor; talebin kliniği
    // doğrulanmazsa aktör kendi kliniğinde sipariş açarken başka kiracının
    // onaylı talebini tüketebilirdi.
    const { handler, orderCreate, requestUpdate } = build({
      request: makeApprovedRequest(OTHER_CLINIC_ID),
    });

    await expect(
      handler.execute(
        new CreatePurchaseOrderCommand(
          data({ purchaseRequestId: REQUEST_ID }),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(PurchaseRequestClinicMismatchException);

    expect(requestUpdate).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('kendi kliniğinin onaylı talebi ORDERED işaretlenir', async () => {
    const request = makeApprovedRequest(CLINIC_ID);
    const { handler, orderCreate, requestUpdate } = build({ request });

    await handler.execute(
      new CreatePurchaseOrderCommand(
        data({ purchaseRequestId: REQUEST_ID }),
        ctx
      )
    );

    expect(request.status).toBe('ORDERED');
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    expect(orderCreate).toHaveBeenCalledTimes(1);
  });

  it('talep bulunamazsa sipariş yazılmaz', async () => {
    const { handler, orderCreate } = build({ request: null });

    await expect(
      handler.execute(
        new CreatePurchaseOrderCommand(
          data({ purchaseRequestId: REQUEST_ID }),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(PurchaseRequestNotFoundException);

    expect(orderCreate).not.toHaveBeenCalled();
  });
});
