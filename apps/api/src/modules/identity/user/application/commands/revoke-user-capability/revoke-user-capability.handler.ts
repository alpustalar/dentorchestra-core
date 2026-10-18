import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RevokeUserCapabilityCommand } from './revoke-user-capability.command';
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
  CapabilityNotFoundException,
  UserNotFoundException,
} from '@modules/identity/user/domain/exceptions/user.exceptions';
import { UserCapabilityRevokedEvent } from '@modules/identity/user/domain/events/user-capability-changed.event';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  CONTEXT_SERVICE,
  IContextService,
} from '@src/infrastructure/context/context.service.interface';
import { USER_EVENTS } from '@src/domain/constants/events';

/**
 * Kişiye özel verilmiş yetkinin geri alınması.
 *
 * Verme tarafındaki "aktör bu yetkiye sahip olmalı" kuralı burada BİLEREK
 * uygulanmaz: geri alma yetki daraltmasıdır, güvenliği azaltmaz. Aksi hâlde
 * yetkisi sonradan düşürülmüş bir yönetici, kendi verdiği yetkiyi geri
 * alamaz hâle gelirdi.
 *
 * Rolden gelen yetkiler buradan kaldırılamaz — kişisel kayıt yoksa 404 döner.
 */
@CommandHandler(RevokeUserCapabilityCommand)
export class RevokeUserCapabilityHandler implements ICommandHandler<
  RevokeUserCapabilityCommand,
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

  async execute(command: RevokeUserCapabilityCommand): Promise<void> {
    const { targetUserId, capability, ctx } = command.payload;

    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) throw new UserNotFoundException();

    this.policyFactory
      .user(ctx.actor, ctx.source)
      .evaluator.check(
        (p) =>
          p.actorCanManageTargetUser({
            clinicId: targetUser.clinicId?.value ?? '',
            priority: targetUser.role?.priority.value ?? 0,
          }),
        'Bu kullanıcının yetkilerini yönetemezsiniz.'
      )
      .orThrow(USER_EVENTS.CAPABILITY_REVOKED);

    const capabilityId =
      await this.capabilityRepo.findCapabilityIdByKey(capability);
    if (!capabilityId) throw new CapabilityNotFoundException(capability);

    await this.txManager.run(async () => {
      const removed = await this.capabilityRepo.revoke(
        targetUserId,
        capabilityId
      );

      // Kişisel kayıt yoksa ya hiç verilmemiştir ya da rolden geliyordur;
      // iki durumda da ortada geri alınacak bir şey yok — event üretilmez.
      if (!removed) throw new CapabilityNotFoundException(capability);

      this.contextService.addEvent(
        new UserCapabilityRevokedEvent({
          targetUserId,
          capability,
          actorId: ctx.actor.userId,
        })
      );
    });
  }
}
