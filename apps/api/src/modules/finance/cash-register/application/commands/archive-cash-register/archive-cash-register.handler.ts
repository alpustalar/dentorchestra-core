import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ArchiveCashRegisterCommand } from './archive-cash-register.command';
import { CashRegisterNotFoundException } from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { CASH_REGISTER_EVENTS } from '@src/domain/constants/events/cash-register.constant';
import {
  CASH_REGISTER_COMMAND_REPOSITORY,
  ICashRegisterCommandRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-register/cash-register.command.repository';

@CommandHandler(ArchiveCashRegisterCommand)
export class ArchiveCashRegisterHandler implements ICommandHandler<
  ArchiveCashRegisterCommand,
  void
> {
  constructor(
    @Inject(CASH_REGISTER_COMMAND_REPOSITORY)
    private readonly cashRegisterRepo: ICashRegisterCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ArchiveCashRegisterCommand): Promise<void> {
    const { registerId, ctx } = command;

    const register = await this.cashRegisterRepo.findById(registerId);
    if (!register) throw new CashRegisterNotFoundException(registerId);

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.canAccessClinicFinances(register.clinicId.value)
      )
      .orThrow(CASH_REGISTER_EVENTS.ARCHIVED);

    register.archive();

    await this.txManager.run(async () => {
      await this.cashRegisterRepo.update(register);
    });
  }
}
