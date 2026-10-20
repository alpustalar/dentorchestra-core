import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateUserByStaffHandler } from './update-user-by-staff.handler';
import { UpdateUserByStaffCommand } from './update-user-by-staff.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { ActorContext } from '@common/interfaces';
import { User } from '@modules/identity/user/domain/entities/user.entity';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Bu uç yalnız PROFİL günceller. Kapsam devri (yönetilen klinik / organizasyon
 * sahipliği) bilerek buradan çıkarıldı: ikisi aynı gövdede taşınırken telefon
 * güncelleyen bir istek, eksik gönderilen bir dizi yüzünden kullanıcının tüm
 * yetki kapsamını silebiliyordu. Testler bu ayrımın geri sızmamasını sabitler.
 */
describe('UpdateUserByStaffHandler', () => {
  const CLINIC = '11111111-1111-4111-8111-111111111111';
  const FOREIGN_CLINIC = '33333333-3333-4333-8333-333333333333';
  const ORG = '44444444-4444-4444-8444-444444444444';
  const ROLE_ID = '66666666-6666-4666-8666-666666666666';
  const NEW_ROLE_ID = '77777777-7777-4777-8777-777777777777';
  const TARGET = 'target-user-uid';

  const manager: ActorContext = {
    userId: 'manager-uid',
    email: 'manager@clinic.com',
    source: LogSource.WEB,
    capabilities: [],
    rolePriority: 80,
    managedClinics: [{ id: CLINIC }],
    ownedOrganizations: [],
    clinicId: CLINIC,
    organizationId: ORG,
  };

  const build = () => {
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
      managedClinicIds: [CLINIC],
      ownedOrganizationIds: [ORG],
      providerProfileId: null,
    });

    const userRepo = {
      findById: jest.fn().mockResolvedValue(targetUser),
      update: jest.fn().mockResolvedValue(targetUser),
      replaceManagedClinics: jest.fn(),
      replaceOwnedOrganizations: jest.fn(),
    };

    const handler = new UpdateUserByStaffHandler(
      userRepo as never,
      new PolicyFactory(new EventEmitter2()),
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = {
      actor: { ...manager },
      source: ExecutionSources.USER_ACTION,
    };

    return { handler, userRepo, targetUser, ctx };
  };

  const run = (
    data: Record<string, unknown>,
    deps: ReturnType<typeof build>,
    targetUserId = TARGET
  ) =>
    deps.handler.execute(
      new UpdateUserByStaffCommand({
        targetUserId,
        data: data as never,
        ctx: deps.ctx,
      })
    );

  it('profil alanlarını günceller', async () => {
    const deps = build();

    await run({ displayName: 'Ada Byron' }, deps);

    // FullName soyadı normalize eder (büyük harf) — VO'nun kendi sözleşmesi.
    expect(deps.targetUser.displayName.value).toBe('Ada BYRON');
    expect(deps.userRepo.update).toHaveBeenCalledWith(deps.targetUser);
  });

  // Gövdeye kapsam alanı sızsa bile (eski istemci, elle atılan istek) entity
  // onları okumaz: yetki devri yalnız kendi uçlarından geçer.
  it('gövdedeki kapsam alanları yok sayılır — yetki silinmez', async () => {
    const deps = build();

    await run(
      {
        phoneNumber: null,
        managedClinicIds: [],
        ownedOrganizationIds: [FOREIGN_CLINIC],
      },
      deps
    );

    expect(deps.targetUser.managedClinicIds?.map((c) => c.value)).toEqual([
      CLINIC,
    ]);
    expect(deps.targetUser.ownedOrganizationIds?.map((o) => o.value)).toEqual([
      ORG,
    ]);
    expect(deps.userRepo.replaceManagedClinics).not.toHaveBeenCalled();
    expect(deps.userRepo.replaceOwnedOrganizations).not.toHaveBeenCalled();
  });

  // Koşul eskiden ters yazılmıştı: `isSelf` doğruyken geçiyor, yani kullanıcı
  // KENDİ rolünü değiştirebiliyor, başkasınınkini değiştiremiyordu.
  it('kullanıcı kendi rolünü değiştiremez', async () => {
    const deps = build();

    await expect(
      run({ roleId: NEW_ROLE_ID }, deps, manager.userId)
    ).rejects.toThrow(ForbiddenException);
    expect(deps.userRepo.update).not.toHaveBeenCalled();
  });

  it('yönettiği kullanıcının rolünü değiştirebilir', async () => {
    const deps = build();

    await run({ roleId: NEW_ROLE_ID }, deps);

    expect(deps.targetUser.roleId.value).toBe(NEW_ROLE_ID);
    expect(deps.userRepo.update).toHaveBeenCalled();
  });
});
