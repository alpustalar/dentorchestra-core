/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { FindPartiesHandler } from './find-parties.handler';
import { FindPartiesQuery } from './find-parties.query';

/**
 * Cari listesi **şube** kapsamında döner. Yetki `clinicId` ile veriliyor ama
 * süzgeç `organizationId` idi: A şubesinin personeli kardeş şubenin
 * tedarikçilerini, hastalarını ve vergi numaralarını görüyordu.
 */
describe('FindPartiesHandler', () => {
  const clinicId = randomUUID();
  const pagination = { page: 1, limit: 20 } as never;
  const ctx = { actor: {}, source: 'WEB' } as never;

  const make = (canAccess = true) => {
    const partyRepo = {
      findMany: jest.fn(async (filter: Record<string, unknown>) => {
        void filter;
        return { items: [], total: 0 };
      }),
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
          getOrganizationSerializationOptions: jest.fn(() => ({
            groups: [],
            isGroupActive: true,
          })),
        },
      }),
    };

    return {
      handler: new FindPartiesHandler(
        partyRepo as never,
        policyFactory as never
      ),
      partyRepo,
    };
  };

  it('listeyi şube kapsamında süzer', async () => {
    const { handler, partyRepo } = make();

    await handler.execute(new FindPartiesQuery(clinicId, pagination, ctx));

    expect(partyRepo.findMany).toHaveBeenCalledWith(
      { clinicId, role: undefined },
      pagination
    );
    // Organizasyon geneli süzgeç KULLANILMAZ (yetki şube seviyesinde).
    expect(partyRepo.findMany.mock.calls[0][0]).not.toHaveProperty(
      'organizationId'
    );
  });

  it('şubeye erişimi olmayan aktör için listeye hiç gitmez', async () => {
    const { handler, partyRepo } = make(false);

    await expect(
      handler.execute(new FindPartiesQuery(clinicId, pagination, ctx))
    ).rejects.toThrow();
    expect(partyRepo.findMany).not.toHaveBeenCalled();
  });
});
