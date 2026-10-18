import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { MarkInstallmentAsRefundedCommand } from './mark-installment-as-refunded.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

@CommandHandler(MarkInstallmentAsRefundedCommand)
export class MarkInstallmentAsRefundedHandler implements ICommandHandler<
  MarkInstallmentAsRefundedCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInstallmentAsRefundedCommand): Promise<void> {
    const { installmentId, details, ctx } = command.payload;

    await this.txManager.outboxRun(async () => {
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      const validateOptions = this.policyFactory
        .entity(ctx.actor, ctx.source)
        .policy.getValidateOptions();

      payment.rules(validateOptions).canRefund().orThrow();

      // PaymentRefundedEvent entity içinde raise edilir; `update()` flush eder.
      payment.refundInstallment({
        installmentId,
        details,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });
      await this.paymentRepo.update(payment);
    });
  }
}
