/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { FindPartiesByIdsHandler } from './find-parties-by-ids.handler';
import { FindPartiesByIdsQuery } from './find-parties-by-ids.query';

describe('FindPartiesByIdsHandler', () => {
  const clinicId = randomUUID();
  const ctx = { actor: {}, source: 'WEB' } as never;

  const make = (canAccess = true) => {
    const partyRepo = {
      findByIds: jest.fn(async (_clinicId: string, ids: string[]) =>
        ids.map((id) => ({ id, name: `Party ${id}`, originId: `uid-${id}` }))
      ),
    };
    const policyFactory = {
      finance: () => ({
        evaluator: {
          check: (predicate: (p: unknown) => boolean, message?: string) => ({
            orThrow: () => {
              if (!predicate({ canAccessClinicFinances: () => canAccess })) {
                throw new Error(message ?? 'yetkisiz');
              }
            },
          }),
        },
        policy: {
          getSerializationOptions: jest.fn(() => ({
            groups: [],
            isGroupActive: true,
          })),
        },
      }),
    };

    return {
      handler: new FindPartiesByIdsHandler(
        partyRepo as never,
        policyFactory as never
      ),
      partyRepo,
    };
  };

  it("ids listesini şube kapsamında repo'ya iletir", async () => {
    const { handler, partyRepo } = make();
    const ids = [randomUUID(), randomUUID()];

    const result = await handler.execute(
      new FindPartiesByIdsQuery({ clinicId, ids, ctx })
    );

    expect(partyRepo.findByIds).toHaveBeenCalledWith(clinicId, ids);
    expect(result.data).toHaveLength(2);
  });

  it("şubeye erişimi olmayan aktör için repo'ya hiç gitmez", async () => {
    const { handler, partyRepo } = make(false);

    await expect(
      handler.execute(
        new FindPartiesByIdsQuery({ clinicId, ids: [randomUUID()], ctx })
      )
    ).rejects.toThrow();
    expect(partyRepo.findByIds).not.toHaveBeenCalled();
  });
});
