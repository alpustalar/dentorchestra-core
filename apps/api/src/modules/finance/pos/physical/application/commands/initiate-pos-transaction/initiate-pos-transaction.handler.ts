import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PosDeviceNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { InitiatePosTransactionCommand } from './initiate-pos-transaction.command';
import { InitiatePosTransactionResponse } from './initiate-pos-transaction.response';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import {
  IPhysicalPosProvider,
  PHYSICAL_POS_PROVIDER,
} from '@modules/finance/pos/physical/domain/interfaces/physical-pos-provider.interface';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CreatePaymentCommand } from '@modules/finance/payment/application/commands/create-payment/create-payment.command';
import PaymentMethodSchema from '@input-type-schemas/PaymentMethodSchema';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';

@CommandHandler(InitiatePosTransactionCommand)
export class InitiatePosTransactionHandler implements ICommandHandler<
  InitiatePosTransactionCommand,
  InitiatePosTransactionResponse
> {
  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionCommandRepo: IPosTransactionCommandRepository,
    @Inject(PHYSICAL_POS_PROVIDER)
    private readonly posProvider: IPhysicalPosProvider,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: InitiatePosTransactionCommand
  ): Promise<InitiatePosTransactionResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const device = await this.posDeviceRepo.findById(input.posDeviceId);
    if (!device) {
      throw new PosDeviceNotFoundException();
    }

    // Yetki `input.clinicId` üzerinden verildi ve ödeme/işlem kayıtları da o
    // klinikle yazılıyor; cihaz aynı kliniğe ait olmak ZORUNDA. Aksi halde kart
    // başka kliniğin terminalinde (yani onun üye işyeri hesabında) çekilir,
    // kayıt buraya düşerdi — defter ile gerçek para akışı ayrışırdı.
    device.assertBelongsToClinic(input.clinicId);

    device.validate.status.isActive.orThrow();

    // Faz 1 — ödeme kaydı + PENDING işlem atomik olarak oluşturulur (TCP öncesi)
    const { posTransactionId, transaction } = await this.txManager.outboxRun(
      async () => {
        const internalPaymentId = input.paymentId ?? UUID.generate().value;
        let paymentId = input.paymentId;
        if (!paymentId && input.patientId) {
          await this.commandBus.execute(
            new CreatePaymentCommand(
              {
                clinicId: input.clinicId,
                patientId: input.patientId,
                appointmentId: input.appointmentId,
                amount: input.amount,
                currency: input.currency,
                method: PaymentMethodSchema.enum.CREDIT_CARD,
              },
              {
                paymentId: internalPaymentId,
              }
            )
          );
          paymentId = internalPaymentId;
        }

        // TODO: burada logic hatası olabilir tekrar kontrol etmek gerekiyor

        const posTransaction = PosTransaction.create({
          initiatedById: ctx.actor.userId,
          posDeviceId: device.id.value,
          clinicId: input.clinicId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          paymentId,
          amount: input.amount,
          currency: input.currency ?? Currency.enum.TRY,
        });

        const savedPosTransaction =
          await this.posTransactionCommandRepo.create(posTransaction);
        return {
          posTransactionId: savedPosTransaction.id,
          transaction: savedPosTransaction,
        };
      }
    );

    const { terminalId, merchantId } = device.getPaxConnection();
    const result = await this.posProvider.initiate({
      posTransactionId: posTransactionId.value,
      terminalId,
      merchantId,
      amount: input.amount,
      currency: input.currency ?? CurrencySchema.enum.TRY,
    });

    // Faz 3 — externalRef kaydedilir
    await this.txManager.run(async () => {
      transaction.setExternalRef(result.externalRef, result.rawRequest);
      await this.posTransactionCommandRepo.update(transaction);
    });

    return {
      posTransactionId: posTransactionId.value,
      externalRef: result.externalRef,
      status: PosTransactionStatusSchema.enum.PENDING,
    };
  }
}
