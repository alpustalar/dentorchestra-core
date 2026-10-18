import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PosTransactionNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { HandlePosCallbackCommand } from './handle-pos-callback.command';
import { HandlePosCallbackResponse } from './handle-pos-callback.response';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import {
  IPhysicalPosProvider,
  PHYSICAL_POS_PROVIDER,
  PosCallbackStatuses,
} from '@modules/finance/pos/physical/domain/interfaces/physical-pos-provider.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';

@CommandHandler(HandlePosCallbackCommand)
export class HandlePosCallbackHandler implements ICommandHandler<
  HandlePosCallbackCommand,
  HandlePosCallbackResponse
> {
  private readonly logger = new Logger(HandlePosCallbackHandler.name);

  constructor(
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionRepo: IPosTransactionCommandRepository,
    @Inject(PHYSICAL_POS_PROVIDER)
    private readonly posProvider: IPhysicalPosProvider,
    private readonly txManager: TransactionManager,
    private readonly posPaymentSync: PosPaymentSyncService
  ) {}

  async execute(
    command: HandlePosCallbackCommand
  ): Promise<HandlePosCallbackResponse> {
    const { input } = command;

    const posCallbackResult = await this.posProvider.parseCallback({
      externalRef: input.externalRef,
      rawResponse: input.rawPayload,
    });

    const { posTransactionId, status } = await this.txManager.outboxRun(
      async () => {
        // Kilitli okuma: POS callback'i tekrar gönderilebilir ve mutabakat taraması
        // aynı işlemi eşzamanlı sonuçlandırabilir. Kilitsizken ikisi de aynı PENDING
        // kaydı okuyup ödemeyi iki kez "ödendi" işaretleyebilirdi.
        const transaction =
          await this.posTransactionRepo.findByExternalRefForUpdate(
            input.externalRef
          );

        if (!transaction) {
          throw new PosTransactionNotFoundException(input.externalRef);
        }

        // Idempotency: cihaz aynı callback'i tekrar gönderebilir. Kilit yalnız
        // sıraya sokar; ikinci isteği durduran şey bu kontroldür. Yoksa işlem
        // yeniden sonuçlandırılır ve ödeme tarafı o an bekleyen BİR SONRAKİ
        // taksiti kapatır — tek çekimle iki taksit tahsil edilmiş görünürdü.
        if (!transaction.validate.status.isPending().value) {
          this.logger.warn(
            `POS callback zaten işlenmiş (idempotency): externalRef=${input.externalRef} durum=${transaction.status}`
          );
          return {
            posTransactionId: transaction.id,
            status: transaction.status,
          };
        }

        switch (posCallbackResult.status) {
          case PosCallbackStatuses.SUCCESS:
            transaction.markSuccess(undefined, posCallbackResult.rawResponse);
            break;
          case PosCallbackStatuses.CANCELLED:
            transaction.markCancelled(posCallbackResult.rawResponse);
            break;
          case PosCallbackStatuses.TIMEOUT:
            transaction.markTimeout();
            break;
          default:
            transaction.markFailed(posCallbackResult.rawResponse);
        }

        await this.posTransactionRepo.update(transaction);

        if (transaction.paymentId) {
          // Callback'i cihaz/banka sunucusu çağırır; aktör iç bağlamdır.
          const ctx = ExecutionContextFactory.createInternal();

          if (posCallbackResult.status === PosCallbackStatuses.SUCCESS) {
            await this.posPaymentSync.markPaid({
              paymentId: transaction.paymentId,
              clinicId: transaction.clinicId.value,
              amount: transaction.amount.value,
              ctx,
            });
          } else if (posCallbackResult.status === PosCallbackStatuses.FAILED) {
            await this.posPaymentSync.markFailed({
              paymentId: transaction.paymentId,
              clinicId: transaction.clinicId.value,
              amount: transaction.amount.value,
              ctx,
            });
          }
        }

        return { posTransactionId: transaction.id, status: transaction.status };
      }
    );

    this.logger.log(
      `POS işlemi güncellendi: id=${posTransactionId.value} status=${status}`
    );

    return { posTransactionId: posTransactionId.value, status };
  }
}
