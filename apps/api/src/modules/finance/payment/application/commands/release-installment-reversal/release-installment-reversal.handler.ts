import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { ReleaseInstallmentReversalCommand } from './release-installment-reversal.command';

@CommandHandler(ReleaseInstallmentReversalCommand)
export class ReleaseInstallmentReversalHandler implements ICommandHandler<
  ReleaseInstallmentReversalCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ReleaseInstallmentReversalCommand): Promise<void> {
    const { installmentId } = command;

    await this.txManager.run(async () => {
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      await this.paymentRepo.setReversalRequestedAt({
        installmentId,
        requestedAt: null,
      });
    });
  }
}
