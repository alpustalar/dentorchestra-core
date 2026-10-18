import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InstallmentNotFoundException } from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { MarkInstallmentAsPaidCommand } from './mark-installment-as-paid.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

/**
 * Taksiti tahsil edilmiş olarak işaretler.
 *
 * `PaymentPaidEvent` burada **yayınlanmaz**: event'i entity yalnız gerçek durum
 * geçişinde raise eder (`update()` flush eder). Handler koşulsuz yayınladığı
 * sürece tekrarlanan POS callback'i, taksit zaten COMPLETED olsa bile ikinci bir
 * cari kayıt işi ve ikinci bir faturalama denemesi üretiyordu.
 */
@CommandHandler(MarkInstallmentAsPaidCommand)
export class MarkInstallmentAsPaidHandler implements ICommandHandler<
  MarkInstallmentAsPaidCommand,
  void
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInstallmentAsPaidCommand): Promise<void> {
    const { installmentId, details, ctx } = command.payload;

    await this.txManager.outboxRun(async () => {
      const payment =
        await this.paymentRepo.findByInstallmentIdForUpdate(installmentId);
      if (!payment) throw new InstallmentNotFoundException(installmentId);

      payment.completeInstallment({
        installmentId,
        details,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });

      await this.paymentRepo.update(payment);
    });
  }
}
