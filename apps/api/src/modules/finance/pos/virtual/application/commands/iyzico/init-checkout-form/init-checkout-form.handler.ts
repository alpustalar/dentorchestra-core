import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InitCheckoutFormCommand } from './init-checkout-form.command';
import { InitCheckoutFormCommandResponse } from './init-checkout-form.response';
import { randomUUID } from 'crypto';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { PaymentInitializeRequest } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/payment-initialize.request';
import {
  IPaymentEventPublisher,
  PAYMENT_EVENT_PUBLISHER,
} from '@modules/finance/payment/domain/interfaces/payment-event-publisher.interface';
import { Inject } from '@nestjs/common';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CreatePaymentCommand } from '@modules/finance/payment/application/commands/create-payment/create-payment.command';
import PaymentMethodSchema from '@input-type-schemas/PaymentMethodSchema';
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';
import { IyzicoTransaction } from '@modules/finance/pos/virtual/domain/entities/iyzico-transaction.entity';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(InitCheckoutFormCommand)
export class InitCheckoutFormHandler implements ICommandHandler<
  InitCheckoutFormCommand,
  InitCheckoutFormCommandResponse
> {
  constructor(
    private readonly commandBus: TSCommandBus,
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    @Inject(IYZICO_TRANSACTION_COMMAND_REPOSITORY)
    private readonly iyzicoCommandRepo: IIyzicoTransactionCommandRepository,
    @Inject(PAYMENT_EVENT_PUBLISHER)
    private readonly paymentEventPublisher: IPaymentEventPublisher,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: InitCheckoutFormCommand
  ): Promise<InitCheckoutFormCommandResponse> {
    const { dto, ip } = command;

    // `dto.clinicId` istek gövdesinden geliyor: kontrol olmadan ödeme yetkisi olan
    // personel başka kliniğin adına ödeme oturumu açabilirdi.
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(dto.clinicId))
      .orThrow('payment.iyzico.checkout');

    const conversationId = randomUUID();

    return await this.txManager.run(async () => {
      const paymentId = crypto.randomUUID();
      const installmentId = crypto.randomUUID();
      await this.commandBus.execute(
        new CreatePaymentCommand({
          clinicId: dto.clinicId,
          patientId: dto.patientId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          currency: CurrencySchema.enum.TRY,
          method: PaymentMethodSchema.enum.CREDIT_CARD,
        })
      );

      const [firstName, ...rest] = dto.patientName.trim().split(' ');
      const lastName = rest.join(' ') || firstName;
      const city = dto.clinicCity ?? 'Istanbul';
      const address = dto.clinicAddress ?? 'Türkiye';

      const iyzicoRequest: PaymentInitializeRequest = {
        locale: 'TR',
        conversationId,
        price: dto.amount,
        paidPrice: dto.amount,
        currency: CurrencySchema.enum.TRY,
        paymentChannel: 'WEB',
        paymentGroup: 'PRODUCT',
        buyer: {
          id: dto.patientId,
          name: firstName,
          surname: lastName,
          gsmNumber: dto.patientPhone,
          email: dto.patientEmail,
          identityNumber: '11111111111',
          registrationAddress: address,
          ip,
          city,
          country: 'Turkey',
        },
        shippingAddress: {
          contactName: dto.patientName,
          city,
          country: 'Turkey',
          address,
        },
        billingAddress: {
          contactName: dto.patientName,
          city,
          country: 'Turkey',
          address,
        },
        basketItems: [
          {
            id: dto.appointmentId ?? dto.patientId,
            name: dto.treatmentName ?? 'Sağlık Hizmeti',
            category1: 'Sağlık',
            itemType: 'VIRTUAL',
            price: dto.amount,
          },
        ],
      };

      const sdkResult =
        await this.iyzicoProvider.paymentInitialize(iyzicoRequest);

      const transaction = IyzicoTransaction.create({
        installmentId,
        conversationId,
        token: sdkResult.token,
      });
      await this.iyzicoCommandRepo.create(transaction);

      this.paymentEventPublisher.paymentInitiated({
        paymentId,
        installmentId,
        token: sdkResult.token,
        appointmentId: dto.appointmentId,
        action: LogAction.PAYMENT_INITIATED,
        type: LogType.INFO,
      });

      return {
        paymentPageUrl: sdkResult.paymentPageUrl!,
        conversationId,
      };
    });
  }
}
