import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AccountingPeriodStatusSchema } from '@shared';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { LockPeriodCommand } from './lock-period.command';
import {
  PeriodConcurrentTransitionException,
  PeriodNotFoundException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@CommandHandler(LockPeriodCommand)
export class LockPeriodHandler implements ICommandHandler<
  LockPeriodCommand,
  void
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: LockPeriodCommand): Promise<void> {
    const period = await this.accountingPeriodRepo.findById(command.periodId);
    if (!period) throw new PeriodNotFoundException();

    // `periodId` istekten geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır
    // (istekteki bir alandan değil — o alan da saldırganın kontrolünde olurdu).
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) =>
        p.actorCanManageTargetClinic(period.clinicId.value)
      )
      .orThrow(ACCOUNTING_EVENTS.PERIOD_LOCK);

    // Durum geçişi + denetim damgası domain'de; DB'ye yazma koşullu (OPEN ise).
    period.lock({
      actorId: command.ctx.actor.userId,
      source: command.ctx.actor.source,
    });

    await this.txManager.run(async () => {
      // Koşulsuz `update(entity)` kullanılmaz: araya giren bir kapanışı geri alır
      // (kapanış fişleri atılmış dönemi tekrar yazılabilir yapardı).
      const claimed = await this.accountingPeriodRepo.claimForLocking(period);
      if (!claimed) {
        throw new PeriodConcurrentTransitionException(
          period.id.value,
          AccountingPeriodStatusSchema.enum.OPEN
        );
      }
    });
  }
}
