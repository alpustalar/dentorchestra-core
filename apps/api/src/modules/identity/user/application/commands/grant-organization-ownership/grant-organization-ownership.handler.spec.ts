import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GrantOrganizationOwnershipHandler } from './grant-organization-ownership.handler';
import { GrantOrganizationOwnershipCommand } from './grant-organization-ownership.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { ActorContext } from '@common/interfaces';
import { User } from '@modules/identity/user/domain/entities/user.entity';
import { UserOrganizationOwnershipGrantedEvent } from '@modules/identity/user/domain/events/user-scope-changed.event';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Organizasyon sahipliği en geniş kapsamdır. Devir ölçütü ÜYELİK değil
 * SAHİPLİKTİR: aynı organizasyonda çalışıyor olmak onu dağıtma hakkı vermez.
 */
describe('GrantOrganizationOwnershipHandler', () => {
  const CLINIC = '11111111-1111-4111-8111-111111111111';
  const ORG = '44444444-4444-4444-8444-444444444444';
  const OTHER_ORG = '55555555-5555-4555-8555-555555555555';
  const ROLE_ID = '66666666-6666-4666-8666-666666666666';
  const TARGET = 'target-user-uid';

  const owner: ActorContext = {
    userId: 'owner-uid',
    email: 'owner@clinic.com',
    source: LogSource.WEB,
    capabilities: [],
    rolePriority: 80,
    managedClinics: [{ id: CLINIC }],
    ownedOrganizations: [{ id: ORG }],
    clinicId: CLINIC,
    organizationId: ORG,
  };

  const build = (
    ownedOrganizationIds: string[] = [],
    actorOverrides: Partial<ActorContext> = {}
  ) => {
    const now = new Date('2026-01-01T00:00:00Z');
    const targetUser = new User({
      id: TARGET,
      displayName: 'Ada Lovelace',
      email: 'ada@clinic.com',
      emailVerified: true,
      status: 'ACTIVE',
      roleId: ROLE_ID,
      picture: null,
      phoneNumber: null,
      clinicId: CLINIC,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      role: { id: ROLE_ID, priority: Priority.fromTrusted(10) },
      workingClinic: { id: CLINIC },
      managedClinicIds: [],
      ownedOrganizationIds,
      providerProfileId: null,
    });

    const userRepo = {
      findById: jest.fn().mockResolvedValue(targetUser),
      replaceOwnedOrganizations: jest.fn().mockResolvedValue(undefined),
    };

    const handler = new GrantOrganizationOwnershipHandler(
      userRepo as never,
      new PolicyFactory(new EventEmitter2()),
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = {
      actor: { ...owner, ...actorOverrides },
      source: ExecutionSources.USER_ACTION,
    };

    return { handler, userRepo, targetUser, ctx };
  };

  const run = (
    organizationIds: string[],
    deps: ReturnType<typeof build>,
    targetUserId = TARGET
  ) =>
    deps.handler.execute(
      new GrantOrganizationOwnershipCommand({
        targetUserId,
        data: { organizationIds },
        ctx: deps.ctx,
      })
    );

  it('sahip olunan organizasyon devredilir ve güvenlik olayı üretir', async () => {
    const deps = build();

    await run([ORG], deps);

    expect(deps.targetUser.ownedOrganizationIds?.map((o) => o.value)).toEqual([
      ORG,
    ]);
    expect(deps.userRepo.replaceOwnedOrganizations).toHaveBeenCalledWith(
      deps.targetUser
    );

    const [event] = deps.targetUser.getDomainEvents();
    expect(event).toBeInstanceOf(UserOrganizationOwnershipGrantedEvent);
    expect(event.log?.details).toMatchObject({ added: [ORG], removed: [] });
  });

  // Aktör bu organizasyonun ÜYESİ (organizationId eşleşiyor) ama SAHİBİ değil.
  it('üyesi olunan ama sahibi olunmayan organizasyon devredilemez', async () => {
    const deps = build([], { ownedOrganizations: [] });

    await expect(run([ORG], deps)).rejects.toThrow(ForbiddenException);
    expect(deps.userRepo.replaceOwnedOrganizations).not.toHaveBeenCalled();
  });

  it('yabancı organizasyon devredilemez', async () => {
    const deps = build();

    await expect(run([OTHER_ORG], deps)).rejects.toThrow(ForbiddenException);
  });

  it('aktör kendine sahiplik veremez — hedef okunmadan reddedilir', async () => {
    const deps = build();

    await expect(run([ORG], deps, owner.userId)).rejects.toThrow(
      ForbiddenException
    );
    expect(deps.userRepo.findById).not.toHaveBeenCalled();
  });

  it('boş dizi sahipliği kaldırır', async () => {
    const deps = build([ORG]);

    await run([], deps);

    expect(deps.targetUser.ownedOrganizationIds).toEqual([]);
    const [event] = deps.targetUser.getDomainEvents();
    expect(event.log?.details).toMatchObject({ added: [], removed: [ORG] });
  });
});
