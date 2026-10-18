import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CancelPaymentCommand } from './cancel-payment.command';
import { CancelPaymentCommandResponse } from './cancel-payment.response';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { IyzicoResultGuard } from '@src/domain/value-objects/iyzico-result-guard.vo';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';

import { Inject } from '@nestjs/common';
import {
  CompletedInstallmentNotFoundException,
  PaymentNotFoundException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { IyzicoPaymentRecordNotFoundException } from '@modules/finance/pos/virtual/domain/exceptions/iyzico.exceptions';
import {
  IPaymentEventPublisher,
  PAYMENT_EVENT_PUBLISHER,
} from '@modules/finance/payment/domain/interfaces/payment-event-publisher.interface';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { MarkInstallmentAsCancelledCommand } from '@modules/finance/payment/application/commands/mark-installment-as-cancelled/mark-installment-as-cancelled.command';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(CancelPaymentCommand)
export class CancelPaymentHandler implements ICommandHandler<
  CancelPaymentCommand,
  CancelPaymentCommandResponse
> {
  private readonly internalCtx = ExecutionContextFactory.createInternal();
  constructor(
    private readonly txManager: TransactionManager,
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    @Inject(IYZICO_TRANSACTION_COMMAND_REPOSITORY)
    private readonly iyzicoCommandRepo: IIyzicoTransactionCommandRepository,
    @Inject(PAYMENT_EVENT_PUBLISHER)
    private readonly paymentEventPublisher: IPaymentEventPublisher,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: CancelPaymentCommand
  ): Promise<CancelPaymentCommandResponse> {
    const {
      dto: { paymentId },
      ip,
    } = command;

    const { data: payment } = await this.queryBus.execute(
      new GetPaymentWithInstallmentsQuery(paymentId)
    );

    if (!payment) throw new PaymentNotFoundException(paymentId);

    // `paymentId` istekten geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır.
    // Kontrol dış SDK çağrısından ÖNCE — sonra olsaydı para çoktan hareket etmişti.
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(payment.clinicId))
      .orThrow('payment.iyzico.cancel');

    const completedInstallment = payment.installments.find(
      (i) => i.status === InstallmentStatusSchema.enum.COMPLETED
    );

    if (!completedInstallment)
      throw new CompletedInstallmentNotFoundException();

    // İptal çağrısı için dış referans (iyzicoPaymentId). Kayıt az önce yazılmış
    // olabileceğinden okuma command repo'dan (ana bağlantı) yapılır; bu akış iyzico
    // işlem kaydını değiştirmediği için kilit gerekmez.
    const iyzicoTx = await this.iyzicoCommandRepo.findByInstallmentId(
      completedInstallment.id
    );

    if (!iyzicoTx?.iyzicoPaymentId) {
      throw new IyzicoPaymentRecordNotFoundException();
    }

    const generatedConversationUUID = UUID.generate();

    const sdkResult = await this.iyzicoProvider.cancelPayment({
      conversationId: generatedConversationUUID.value,
      paymentId: iyzicoTx.iyzicoPaymentId,
      ip,
    });

    IyzicoResultGuard.create({
      status: sdkResult.status,
      errorMessage: sdkResult?.errorMessage,
    })
      .isSuccess()
      .orThrow();

    await this.txManager.outboxRun(async () => {
      await this.commandBus.execute(
        new MarkInstallmentAsCancelledCommand(
          completedInstallment.id,
          this.internalCtx
        )
      );

      this.paymentEventPublisher.paymentCancelled({
        paymentId: payment.id,
        appointmentId: payment.appointmentId ?? null,
        clinicId: payment.clinicId,
        action: LogAction.PAYMENT_CANCELLED,
        type: LogType.INFO,
        details: 'Ödeme iptali başarılı',
      });
    });
  }
}
