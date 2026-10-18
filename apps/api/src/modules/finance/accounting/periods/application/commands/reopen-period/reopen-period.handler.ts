import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AccountingPeriodStatusSchema } from '@shared';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { ReopenPeriodCommand } from './reopen-period.command';
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

@CommandHandler(ReopenPeriodCommand)
export class ReopenPeriodHandler implements ICommandHandler<
  ReopenPeriodCommand,
  void
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodCommandRepository,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: ReopenPeriodCommand): Promise<void> {
    const period = await this.accountingPeriodRepo.findById(command.periodId);
    if (!period) throw new PeriodNotFoundException();

    // `periodId` istekten geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır
    // (istekteki bir alandan değil — o alan da saldırganın kontrolünde olurdu).
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) =>
        p.actorCanManageTargetClinic(period.clinicId.value)
      )
      .orThrow(ACCOUNTING_EVENTS.PERIOD_REOPEN);

    period.reopen({
      actorId: command.ctx.actor.userId,
      source: command.ctx.actor.source,
    });

    await this.txManager.run(async () => {
      // Koşullu geçiş: dönem bu arada CLOSED'a alındıysa 0 satır etkilenir ve
      // kapanmış dönem "dirilmez" (koşulsuz update tam bunu yapıyordu).
      const claimed = await this.accountingPeriodRepo.claimForReopening(period);
      if (!claimed) {
        throw new PeriodConcurrentTransitionException(
          period.id.value,
          AccountingPeriodStatusSchema.enum.LOCKED
        );
      }
    });
  }
}
