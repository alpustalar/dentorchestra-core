import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { MarkInstallmentAsCancelledCommand } from './mark-installment-as-cancelled.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

@CommandHandler(MarkInstallmentAsCancelledCommand)
export class MarkInstallmentAsCancelledHandler implements ICommandHandler<
  MarkInstallmentAsCancelledCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInstallmentAsCancelledCommand): Promise<void> {
    const { installmentId } = command;

    const validateOptions = this.policyFactory
      .entity(command.ctx.actor, command.ctx.source)
      .policy.getValidateOptions();

    await this.txManager.run(async () => {
      // Kilitli okuma: iptal kararı ödemenin o anki durumundan türüyor.
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      payment.rules(validateOptions).canCancel().orThrow();

      payment.cancelInstallment(installmentId);
      await this.paymentRepo.update(payment);
    });
  }
}
