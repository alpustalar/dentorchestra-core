import { Decimal } from 'decimal.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SoftDeleteProductHandler } from './soft-delete-product.handler';
import { SoftDeleteProductCommand } from './soft-delete-product.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import {
  ProductHasStockException,
  ProductNotFoundException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Silme `deletedAt` damgalıyor; stok seviyesi sorgusu ürünleri `deletedAt: null`
 * süzdüğü için partiler yerinde kalır ama envanter değeri hiçbir listede
 * görünmez. Bu yüzden üzerinde stok duran ürün silinemez.
 */
describe('SoftDeleteProductHandler — eldeki stok koruması', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

  const actor: ActorContext = {
    userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    email: 'owner@clinic.com',
    source: LogSource.WEB,
    capabilities: ['product:delete'],
    rolePriority: 90,
    managedClinics: [{ id: CLINIC_ID }],
    ownedOrganizations: [{ id: ORG_ID }],
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
  };

  const build = (options: { onHand?: number; product?: boolean } = {}) => {
    const softDelete = jest.fn();
    const update = jest.fn();

    const productRepo = {
      findById: jest.fn().mockResolvedValue(
        options.product === false
          ? null
          : {
              id: { value: PRODUCT_ID },
              clinicId: { value: CLINIC_ID },
              organizationId: { value: ORG_ID },
              softDelete,
            }
      ),
      update,
    };

    const handler = new SoftDeleteProductHandler(
      productRepo as never,
      {
        sumOnHandByProduct: jest
          .fn()
          .mockResolvedValue(new Decimal(options.onHand ?? 0)),
      } as never,
      new PolicyFactory(new EventEmitter2()),
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };

    return {
      softDelete,
      update,
      execute: () =>
        handler.execute(new SoftDeleteProductCommand(PRODUCT_ID, ctx)),
    };
  };

  it('eldeki stok varsa silme reddedilir — damga vurulmaz', async () => {
    const { execute, softDelete, update } = build({ onHand: 12.5 });

    await expect(execute()).rejects.toBeInstanceOf(ProductHasStockException);
    expect(softDelete).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('stok sıfırsa silinir', async () => {
    const { execute, softDelete, update } = build({ onHand: 0 });

    await execute();

    expect(softDelete).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('ürün yoksa ProductNotFoundException', async () => {
    const { execute } = build({ product: false });

    await expect(execute()).rejects.toBeInstanceOf(ProductNotFoundException);
  });
});
