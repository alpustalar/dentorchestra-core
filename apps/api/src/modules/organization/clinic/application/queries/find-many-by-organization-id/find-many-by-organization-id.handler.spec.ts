import { FindManyByOrganizationIdHandler } from './find-many-by-organization-id.handler';
import { FindManyByOrganizationIdQuery } from './find-many-by-organization-id.query';
import { IClinicQueryRepository } from '@modules/organization/clinic/domain/repositories/clinic/clinic.query.repository';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';
import { Clinic } from '@shared';
import { OrganizationScopeRequiredException } from '@common/domain/exceptions/organization-scope-required.exception';

/**
 * Organizasyon-geniş klinik dizini: bir aktörün kendi organizasyonu
 * dışındaki kliniklere sızmaması ve platformun kendi defter-sahibi
 * şubesinin tenant-facing dizinde hiç görünmemesi doğrulanır.
 */
describe('FindManyByOrganizationIdHandler', () => {
  const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

  const buildClinic = (overrides: Partial<Clinic> = {}): Clinic => ({
    id: '22222222-2222-4222-8222-222222222222',
    organizationId: ORGANIZATION_ID,
    sectorId: 'sector-1',
    name: 'Merkez Şube',
    slug: 'merkez-sube',
    phone: null,
    email: null,
    address: null,
    city: null,
    district: null,
    latitude: null,
    longitude: null,
    consultationSlotDuration: 15,
    isPlatform: false,
    logo: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    status: 'ACTIVE',
    timezone: 'Europe_Istanbul',
    ...overrides,
  });

  const build = (clinics: Clinic[], allowed = true) => {
    const findManyByOrganizationId = jest.fn(() => Promise.resolve(clinics));
    const repo = {
      findManyByOrganizationId,
    } as unknown as IClinicQueryRepository;

    const checkedOrganizations: string[] = [];
    const orThrow = jest.fn(() => {
      if (!allowed) throw new Error('forbidden');
    });
    const policyFactory = {
      organization: jest.fn().mockReturnValue({
        evaluator: {
          check: (
            fn: (p: {
              actorCanAccessTargetOrganization: (id: string) => boolean;
            }) => void
          ) => {
            fn({
              actorCanAccessTargetOrganization: (id: string) => {
                checkedOrganizations.push(id);
                return allowed;
              },
            });
            return { orThrow };
          },
        },
        policy: {
          getSerializationOptions: () => ({ groups: [], isGroupActive: true }),
        },
      }),
    } as never;

    return {
      handler: new FindManyByOrganizationIdHandler(repo, policyFactory),
      findManyByOrganizationId,
      checkedOrganizations,
    };
  };

  const ctx = (organizationId?: string): IGetContext => ({
    actor: { userId: 'user-1', organizationId } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  });

  it('platform şubesini eleyip minimal alanlarla döner', async () => {
    const platformClinic = buildClinic({
      id: '33333333-3333-4333-8333-333333333333',
      isPlatform: true,
    });
    const tenantClinic = buildClinic();
    const { handler, checkedOrganizations } = build([
      platformClinic,
      tenantClinic,
    ]);

    const result = await handler.execute(
      new FindManyByOrganizationIdQuery(ORGANIZATION_ID, ctx(ORGANIZATION_ID))
    );

    expect(result.data).toEqual([
      {
        id: tenantClinic.id,
        organizationId: tenantClinic.organizationId,
        name: tenantClinic.name,
        slug: tenantClinic.slug,
        timezone: tenantClinic.timezone,
        status: tenantClinic.status,
      },
    ]);
    expect(checkedOrganizations).toEqual([ORGANIZATION_ID]);
  });

  it('organizationId verilmezse aktörün kendi organizasyonuna düşer', async () => {
    const { handler, findManyByOrganizationId, checkedOrganizations } = build([
      buildClinic(),
    ]);

    await handler.execute(
      new FindManyByOrganizationIdQuery(undefined, ctx(ORGANIZATION_ID))
    );

    expect(findManyByOrganizationId).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(checkedOrganizations).toEqual([ORGANIZATION_ID]);
  });

  it('istekte ve aktör bağlamında organizasyon yoksa kapıda durdurur', async () => {
    const { handler } = build([buildClinic()]);

    await expect(
      handler.execute(new FindManyByOrganizationIdQuery(undefined, ctx()))
    ).rejects.toThrow(OrganizationScopeRequiredException);
  });

  it('aktör o organizasyona erişemiyorsa dizin sızdırılmaz', async () => {
    const { handler } = build([buildClinic()], false);

    await expect(
      handler.execute(
        new FindManyByOrganizationIdQuery(ORGANIZATION_ID, ctx(ORGANIZATION_ID))
      )
    ).rejects.toThrow('forbidden');
  });
});
