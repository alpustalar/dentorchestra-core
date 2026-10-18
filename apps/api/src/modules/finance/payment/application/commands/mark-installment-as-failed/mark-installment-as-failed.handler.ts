import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { MarkInstallmentAsFailedCommand } from './mark-installment-as-failed.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

/**
 * Tahsilat denemesinin başarısızlığını taksite işler (taksit yeniden denenebilir
 * olur). `PaymentFailedEvent` entity içinde raise edilir; tahsil edilmiş bir
 * taksit bu yoldan geçemez (bkz. `InstallmentNotFailableException`).
 */
@CommandHandler(MarkInstallmentAsFailedCommand)
export class MarkInstallmentAsFailedHandler implements ICommandHandler<
  MarkInstallmentAsFailedCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInstallmentAsFailedCommand): Promise<void> {
    const { installmentId, details, ctx } = command.payload;

    await this.txManager.outboxRun(async () => {
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      payment.failInstallment({
        installmentId,
        details,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });

      await this.paymentRepo.update(payment);
    });
  }
}
