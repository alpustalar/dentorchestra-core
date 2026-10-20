import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateLeadHandler } from './create-lead.handler';
import { CreateLeadCommand } from './create-lead.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { ActorContext } from '@common/interfaces';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * `POST clinics/:clinicId/leads` — clinicId URL'den gelir ve CapabilityGuard
 * yalnız `lead:create` yeteneğine bakar. Kapsam kontrolü olmadan, bu yetkiye
 * sahip herhangi bir personel başka bir kiracının kliniğine lead yazabiliyordu.
 */
describe('CreateLeadHandler — klinik kapsamı', () => {
  const CLINIC = 'clinic-a';
  const ORG = 'org-1';
  /** Kapıdan geçildiğini kanıtlayan işaret: policy'den sonraki ilk adım. */
  const GATE_PASSED = new Error('gate-passed');

  const actor = (over: Partial<ActorContext>): ActorContext => ({
    userId: 'user-1',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['lead:create'],
    rolePriority: 50,
    managedClinics: [],
    ownedOrganizations: [],
    ...over,
  });

  const run = (a: ActorContext, clinicId: string) => {
    const leadRepo = { create: jest.fn() };
    const queryBus = { execute: jest.fn().mockRejectedValue(GATE_PASSED) };

    const handler = new CreateLeadHandler(
      leadRepo as never,
      { resolve: jest.fn().mockResolvedValue(ORG) } as never,
      new PolicyFactory(new EventEmitter2()),
      queryBus as never,
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = { actor: a, source: ExecutionSources.USER_ACTION };

    return {
      leadRepo,
      execute: () =>
        handler.execute(
          new CreateLeadCommand({
            data: { name: 'Ayşe', source: 'WEBSITE' } as never,
            clinicId,
            ctx,
          })
        ),
    };
  };

  it('başka kiracının kliniğine lead yazılamaz', async () => {
    const { execute, leadRepo } = run(
      actor({ clinicId: CLINIC, organizationId: ORG }),
      'other-tenant-clinic'
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
    expect(leadRepo.create).not.toHaveBeenCalled();
  });

  it('kendi kliniğinde kapıdan geçer', async () => {
    const { execute } = run(
      actor({ clinicId: CLINIC, organizationId: ORG }),
      CLINIC
    );

    await expect(execute()).rejects.toBe(GATE_PASSED);
  });

  it('organizasyon sahibi kendi org’undaki klinikte geçer', async () => {
    const { execute } = run(
      actor({
        clinicId: undefined,
        ownedOrganizations: [{ id: ORG }],
        organizationId: ORG,
      }),
      CLINIC
    );

    await expect(execute()).rejects.toBe(GATE_PASSED);
  });
});
