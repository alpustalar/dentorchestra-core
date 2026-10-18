import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GrantUserCapabilityCommand } from './grant-user-capability.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IUserCommandRepository,
  USER_COMMAND_REPOSITORY,
} from '@modules/identity/user/domain/repositories/user/user.command.repository';
import {
  IUserCapabilityCommandRepository,
  USER_CAPABILITY_COMMAND_REPOSITORY,
} from '@modules/identity/user/domain/repositories/user-capability/user-capability.command.repository';
import {
  CapabilityAlreadyInRoleException,
  CapabilityNotFoundException,
  CapabilityNotHeldByActorException,
  PlatformCapabilityNotGrantableException,
  UserNotFoundException,
} from '@modules/identity/user/domain/exceptions/user.exceptions';
import { UserCapabilityGrantedEvent } from '@modules/identity/user/domain/events/user-capability-changed.event';
import { isPlatformCapability } from '@src/infrastructure/persistence/prisma/data/modules';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  CONTEXT_SERVICE,
  IContextService,
} from '@src/infrastructure/context/context.service.interface';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { USER_EVENTS } from '@src/domain/constants/events';

/**
 * Klinik yöneticisinin, yönettiği klinikteki bir personele rolünün ÜSTÜNE
 * tek bir yetki vermesi.
 *
 * Üç kapı sırayla tutulur ve sırası önemlidir — en ucuz/en kesin olan önce:
 * 1. **Platform kapsamı** (veriye bakmadan): abonelik, plan, rol/yetki tesisatı
 *    kimseye devredilemez.
 * 2. **Aktörün kendi tavanı**: sahip olmadığını veremez, yoksa personeli
 *    üzerinden kendi yetkisini yükseltirdi.
 * 3. **Hedefin yönetim kapsamı**: hedef, aktörün yönettiği bir klinikte ve
 *    ondan düşük öncelikte olmalı.
 */
@CommandHandler(GrantUserCapabilityCommand)
export class GrantUserCapabilityHandler implements ICommandHandler<
  GrantUserCapabilityCommand,
  void
> {
  constructor(
    @Inject(USER_COMMAND_REPOSITORY)
    private readonly userRepo: IUserCommandRepository,
    @Inject(USER_CAPABILITY_COMMAND_REPOSITORY)
    private readonly capabilityRepo: IUserCapabilityCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(CONTEXT_SERVICE)
    private readonly contextService: IContextService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: GrantUserCapabilityCommand): Promise<void> {
    const { targetUserId, data, ctx } = command.payload;
    const { capability, reason } = data;

    const { policy, evaluator } = this.policyFactory.user(
      ctx.actor,
      ctx.source
    );

    // 1) Platform kapsamı — hedefe hiç bakmadan reddedilir.
    if (isPlatformCapability(capability)) {
      throw new PlatformCapabilityNotGrantableException(capability);
    }

    // 2) Aktörün kendi tavanı.
    if (!policy.actorCanGrantCapability(capability)) {
      throw new CapabilityNotHeldByActorException(capability);
    }

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) throw new UserNotFoundException();

    // 3) Hedef, aktörün yönettiği klinikte ve ondan düşük öncelikte mi?
    evaluator
      .check(
        (p) =>
          p.actorCanManageTargetUser({
            clinicId: targetUser.clinicId?.value ?? '',
            priority: targetUser.role?.priority.value ?? 0,
          }),
        'Bu kullanıcının yetkilerini yönetemezsiniz.'
      )
      .orThrow(USER_EVENTS.CAPABILITY_GRANTED);

    const capabilityId =
      await this.capabilityRepo.findCapabilityIdByKey(capability);
    if (!capabilityId) throw new CapabilityNotFoundException(capability);

    // Rolde zaten varsa kişisel kayıt açmak yanıltıcı olur: rol değiştiğinde
    // "neden hâlâ görüyor" (ya da tersi) sorusunu doğurur.
    const alreadyInRole = await this.capabilityRepo.roleGrantsCapability(
      targetUserId,
      capabilityId
    );
    if (alreadyInRole) throw new CapabilityAlreadyInRoleException(capability);

    await this.txManager.run(async () => {
      await this.capabilityRepo.grant({
        id: UUID.generate().value,
        userId: targetUserId,
        capabilityId,
        grantedById: ctx.actor.userId,
        reason: reason ?? null,
      });

      this.contextService.addEvent(
        new UserCapabilityGrantedEvent({
          targetUserId,
          capability,
          actorId: ctx.actor.userId,
          reason,
        })
      );
    });
  }
}
