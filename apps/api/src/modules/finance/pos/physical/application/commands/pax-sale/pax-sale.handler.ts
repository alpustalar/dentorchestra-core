import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PosDeviceNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxSaleCommand } from './pax-sale.command';
import type { PaxSaleResponse } from './pax-sale.response';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import {
  PaxConnectionError,
  PaxTimeoutError,
} from '@src/infrastructure/payment/pos/physical/providers/pax/pax.errors';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CreatePaymentCommand } from '@modules/finance/payment/application/commands/create-payment/create-payment.command';
import PaymentMethodSchema from '@input-type-schemas/PaymentMethodSchema';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';
import { UUID } from '@src/domain/value-objects/uuid.vo';

@CommandHandler(PaxSaleCommand)
export class PaxSaleHandler implements ICommandHandler<
  PaxSaleCommand,
  PaxSaleResponse
> {
  private readonly logger = new Logger(PaxSaleHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionRepo: IPosTransactionCommandRepository,
    private readonly paxService: PaxService,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager,
    private readonly posPaymentSync: PosPaymentSyncService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly accountingBridge: PosAccountingBridgeService
  ) {}

  async execute(command: PaxSaleCommand): Promise<PaxSaleResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const device = await this.posDeviceRepo.findById(input.posDeviceId);
    if (!device) {
      throw new PosDeviceNotFoundException();
    }

    // Yetki `input.clinicId` üzerinden verildi; cihaz AYRI bir alandan geliyor. Bu doğrulama
    // olmadan kendi kliniğinin id'siyle başka kliniğin terminali sürülebilirdi.
    device.assertBelongsToClinic(input.clinicId);

    device.validate.status.isActive.orThrow();

    // Faz 1 — ödeme kaydı + PENDING işlem atomik olarak oluşturulur (TCP öncesi)
    const { posTransactionId, transaction, paymentId } =
      await this.txManager.outboxRun(async () => {
        let resolvedPaymentId = input.paymentId;

        const paymentId = UUID.generate().value;
        if (!resolvedPaymentId && input.patientId) {
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
              { paymentId }
            )
          );
          resolvedPaymentId = paymentId;
        }

        const posTransaction = PosTransaction.create({
          initiatedById: ctx.actor.userId,
          posDeviceId: device.id.value,
          clinicId: input.clinicId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          paymentId: resolvedPaymentId,
          amount: input.amount,
          currency: input.currency,
        });

        const tx = await this.posTransactionRepo.create(posTransaction);
        return {
          posTransactionId: tx.id.value,
          transaction: tx,
          paymentId: resolvedPaymentId,
        };
      });

    // Faz 2 — PAX TCP çağrısı (transaction dışında; bloke edici, ~90s)
    try {
      const result = await this.paxService.sale({
        device: device.getPaxConnection(),
        // Kuruşa çevirim Decimal üzerinden: `input.amount * 100` kayan nokta
        // aritmetiğiydi ve kayıt ile cihaza giden tutarı ayrıştırabilirdi.
        amountInMinorUnits: transaction.amount.value
          .times(100)
          .round()
          .toNumber(),
        ecReferenceNumber: posTransactionId,
      });

      // Faz 3 — sonuç + payment senkron + ledger atomik (outboxRun)
      await this.txManager.outboxRun(async () => {
        if (result.approved) {
          transaction.markSuccess(result.externalRef, result.rawResponse);
          await this.posTransactionRepo.update(transaction);
          if (paymentId) {
            await this.posPaymentSync.markPaid({
              paymentId,
              clinicId: input.clinicId,
              amount: transaction.amount.value,
              ctx,
            });
          }
          // Muhasebe köprüsü: kart tahsilatı → 108 / 120 (cari hasta varsa).
          if (input.patientId) {
            await this.accountingBridge.recordBestEffort({
              kind: 'SALE',
              patientId: input.patientId,
              clinicId: input.clinicId,
              amount: transaction.amount.value,
              posTransactionId,
            });
          }
        } else {
          transaction.markFailed(result.rawResponse);
          await this.posTransactionRepo.update(transaction);
          if (paymentId) {
            await this.posPaymentSync.markFailed({
              paymentId,
              clinicId: input.clinicId,
              amount: transaction.amount.value,
              ctx,
              reason: result.responseText,
            });
          }
        }
      });

      const status = result.approved
        ? PosTransactionStatusSchema.enum.SUCCESS
        : PosTransactionStatusSchema.enum.FAILED;

      this.logger.log(
        `PAX satış tamamlandı: id=${posTransactionId} status=${status}`
      );

      return {
        posTransactionId,
        status,
        approved: result.approved,
        responseText: result.responseText,
        authorizationCode: result.authorizationCode,
        externalRef: result.externalRef,
        maskedCardNumber: result.maskedCardNumber,
        cardType: result.cardType,
      };
    } catch (err) {
      if (err instanceof PaxTimeoutError) {
        this.logger.warn(
          `PAX satış timeout: id=${posTransactionId} — PENDING kalıyor`
        );
        return {
          posTransactionId,
          status: PosTransactionStatusSchema.enum.PENDING,
        };
      }

      if (err instanceof PaxConnectionError) {
        await this.txManager.outboxRun(async () => {
          transaction.markFailed();
          await this.posTransactionRepo.update(transaction);
          if (paymentId) {
            await this.posPaymentSync.markFailed({
              paymentId,
              clinicId: input.clinicId,
              amount: transaction.amount.value,
              ctx,
              reason: 'POS cihazına bağlanılamadı',
            });
          }
        });
        this.logger.error(`PAX satış bağlantı hatası: id=${posTransactionId}`);
        return {
          posTransactionId,
          status: PosTransactionStatusSchema.enum.FAILED,
        };
      }

      throw err;
    }
  }
}
