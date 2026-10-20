import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignManagedClinicsHandler } from './assign-managed-clinics.handler';
import { AssignManagedClinicsCommand } from './assign-managed-clinics.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { ActorContext } from '@common/interfaces';
import { User } from '@modules/identity/user/domain/entities/user.entity';
import { UserManagedClinicsAssignedEvent } from '@modules/identity/user/domain/events/user-scope-changed.event';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Kapsam devri artık profil güncellemesinden ayrı bir command: farklı iş kuralı,
 * farklı güvenlik seviyesi, ayrı denetim olayı. Testler devrin sınırını
 * (yalnız yönetilen klinik atanabilir) ve olayın üretildiğini sabitler.
 */
describe('AssignManagedClinicsHandler', () => {
  const OWN_CLINIC = '11111111-1111-4111-8111-111111111111';
  const OTHER_OWN_CLINIC = '22222222-2222-4222-8222-222222222222';
  const FOREIGN_CLINIC = '33333333-3333-4333-8333-333333333333';
  const ORG = '44444444-4444-4444-8444-444444444444';
  const FOREIGN_ORG = '55555555-5555-4555-8555-555555555555';
  const ROLE_ID = '66666666-6666-4666-8666-666666666666';
  const TARGET = 'target-user-uid';

  const manager: ActorContext = {
    userId: 'manager-uid',
    email: 'manager@clinic.com',
    source: LogSource.WEB,
    capabilities: [],
    rolePriority: 80,
    managedClinics: [{ id: OWN_CLINIC }, { id: OTHER_OWN_CLINIC }],
    ownedOrganizations: [],
    clinicId: OWN_CLINIC,
    organizationId: ORG,
  };

  const buildTarget = (managedClinicIds: string[]) => {
    const now = new Date('2026-01-01T00:00:00Z');
    return new User({
      id: TARGET,
      displayName: 'Ada Lovelace',
      email: 'ada@clinic.com',
      emailVerified: true,
      status: 'ACTIVE',
      roleId: ROLE_ID,
      picture: null,
      phoneNumber: null,
      clinicId: OWN_CLINIC,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      role: { id: ROLE_ID, priority: Priority.fromTrusted(10) },
      workingClinic: { id: OWN_CLINIC },
      managedClinicIds,
      ownedOrganizationIds: [],
      providerProfileId: null,
    });
  };

  const build = (managedClinicIds: string[] = []) => {
    const targetUser = buildTarget(managedClinicIds);

    const userRepo = {
      findById: jest.fn().mockResolvedValue(targetUser),
      replaceManagedClinics: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new AssignManagedClinicsHandler(
      userRepo as never,
      new PolicyFactory(new EventEmitter2()),
      {
        resolve: jest.fn(({ clinicId }: { clinicId: string }) =>
          Promise.resolve(clinicId === FOREIGN_CLINIC ? FOREIGN_ORG : ORG)
        ),
      } as never,
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = {
      actor: { ...manager },
      source: ExecutionSources.USER_ACTION,
    };

    return { handler, userRepo, targetUser, ctx };
  };

  const run = (
    clinicIds: string[],
    deps: ReturnType<typeof build>,
    targetUserId = TARGET
  ) =>
    deps.handler.execute(
      new AssignManagedClinicsCommand({
        targetUserId,
        data: { clinicIds },
        ctx: deps.ctx,
      })
    );

  it('yönetilen klinik atanır, yazılır ve güvenlik olayı üretir', async () => {
    const deps = build();

    await run([OWN_CLINIC], deps);

    expect(deps.targetUser.managedClinicIds?.map((c) => c.value)).toEqual([
      OWN_CLINIC,
    ]);
    expect(deps.userRepo.replaceManagedClinics).toHaveBeenCalledWith(
      deps.targetUser
    );

    const [event] = deps.targetUser.getDomainEvents();
    expect(event).toBeInstanceOf(UserManagedClinicsAssignedEvent);
    expect(event.log?.details).toMatchObject({
      targetUserId: TARGET,
      added: [OWN_CLINIC],
      removed: [],
    });
  });

  it('yönetilmeyen klinik atanamaz — kayıt yazılmaz', async () => {
    const deps = build();

    await expect(run([FOREIGN_CLINIC], deps)).rejects.toThrow(
      ForbiddenException
    );
    expect(deps.userRepo.replaceManagedClinics).not.toHaveBeenCalled();
    expect(deps.targetUser.managedClinicIds).toEqual([]);
  });

  it('listedeki tek bir yabancı klinik tüm isteği düşürür', async () => {
    const deps = build();

    await expect(run([OWN_CLINIC, FOREIGN_CLINIC], deps)).rejects.toThrow(
      ForbiddenException
    );
    expect(deps.userRepo.replaceManagedClinics).not.toHaveBeenCalled();
  });

  it('aktör kendi kapsamını genişletemez — hedef okunmadan reddedilir', async () => {
    const deps = build();

    await expect(run([OWN_CLINIC], deps, manager.userId)).rejects.toThrow(
      ForbiddenException
    );
    expect(deps.userRepo.findById).not.toHaveBeenCalled();
  });

  it('boş dizi kapsamı kaldırır ve kaldırılanlar olaya yazılır', async () => {
    const deps = build([OWN_CLINIC]);

    await run([], deps);

    expect(deps.targetUser.managedClinicIds).toEqual([]);
    const [event] = deps.targetUser.getDomainEvents();
    expect(event.log?.details).toMatchObject({
      added: [],
      removed: [OWN_CLINIC],
    });
  });

  it('fark yoksa denetim kaydı üretilmez', async () => {
    const deps = build([OWN_CLINIC]);

    await run([OWN_CLINIC], deps);

    expect(deps.targetUser.getDomainEvents()).toHaveLength(0);
  });
});
