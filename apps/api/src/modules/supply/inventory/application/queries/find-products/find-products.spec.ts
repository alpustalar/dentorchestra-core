import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FindProductsHandler } from './find-products.handler';
import { FindProductsQuery } from './find-products.query';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { PaginationDto } from '@shared';

/**
 * Katalog **klinik** kapsamlıdır. Eskiden organizasyon kapsamında listeleniyor
 * ve serileştirme ayarları `result.items[0].clinicId`'den okunuyordu: boş
 * katalog 500 veriyor, dolu listede alan görünürlüğü rastgele bir satırın
 * kliniğine göre hesaplanıyordu.
 */
describe('FindProductsHandler — klinik kapsamı', () => {
  const CLINIC_A = '11111111-1111-4111-8111-111111111111';
  const CLINIC_B = '22222222-2222-4222-8222-222222222222';
  const ORG_1 = '33333333-3333-4333-8333-333333333333';

  const actor: ActorContext = {
    userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['product:read'],
    rolePriority: 50,
    managedClinics: [{ id: CLINIC_A }],
    ownedOrganizations: [],
    clinicId: CLINIC_A,
    organizationId: ORG_1,
  };

  const build = (items: { id: string; clinicId: string }[]) => {
    const findMany = jest
      .fn()
      .mockResolvedValue({ items, total: items.length });

    const handler = new FindProductsHandler(
      { findMany } as never,
      new PolicyFactory(new EventEmitter2()),
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };

    return {
      findMany,
      execute: (clinicId: string = CLINIC_A) =>
        handler.execute(
          new FindProductsQuery({
            pagination: { page: 1, limit: 20 } as PaginationDto,
            clinicId,
            ctx,
          })
        ),
    };
  };

  it('boş katalogda hata vermez', async () => {
    const { execute } = build([]);

    const result = await execute();

    expect(result.data).toEqual([]);
    expect(result.meta?.pagination?.total).toBe(0);
  });

  it('liste kliniğe göre süzülür', async () => {
    const { execute, findMany } = build([{ id: 'p1', clinicId: CLINIC_A }]);

    await execute();

    expect(findMany).toHaveBeenCalledWith(CLINIC_A, expect.anything());
  });

  it('başka kiracının kliniğinin kataloğu listelenemez', async () => {
    const { execute, findMany } = build([]);

    await expect(execute(CLINIC_B)).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
