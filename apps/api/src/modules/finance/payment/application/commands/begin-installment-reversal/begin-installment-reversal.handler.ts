import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
  InstallmentReversalInFlightException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { REVERSAL_RETRY_AFTER_MINUTES } from '@modules/finance/payment/domain/constants/installment-reversal.constant';
import { BeginInstallmentReversalCommand } from './begin-installment-reversal.command';

@CommandHandler(BeginInstallmentReversalCommand)
export class BeginInstallmentReversalHandler implements ICommandHandler<
  BeginInstallmentReversalCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: BeginInstallmentReversalCommand): Promise<void> {
    const { installmentId } = command;

    await this.txManager.run(async () => {
      // Kilit önce, okuma sonra: itiraz açılışı (`lockAndGetCollectedAmount`) aynı
      // ödeme satırını kilitler, iki yol sıraya girer.
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      const installment = payment.installments.find(
        (i) => i.id === installmentId
      );
      if (!installment) throw new InstallmentNotFoundException(installmentId);

      if (installment.status !== InstallmentStatusSchema.enum.COMPLETED) {
        throw new InstallmentNotRefundableException({
          installmentId,
          status: installment.status,
        });
      }

      const now = DateTimeManager.create();
      const previous = installment.reversalRequestedAt;
      if (
        previous &&
        DateTimeManager.diffInMinutes(now, previous) <
          REVERSAL_RETRY_AFTER_MINUTES
      ) {
        throw new InstallmentReversalInFlightException({
          installmentId,
          requestedAt: previous.toISOString(),
        });
      }

      await this.paymentRepo.setReversalRequestedAt({
        installmentId,
        requestedAt: now,
      });
    });
  }
}
