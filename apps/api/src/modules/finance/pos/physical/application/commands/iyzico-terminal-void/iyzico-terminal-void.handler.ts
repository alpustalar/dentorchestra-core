import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import CardChargebackSourceSchema from '@input-type-schemas/CardChargebackSourceSchema';
import {
  CARD_CHARGEBACK_EXPOSURE_GUARD,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { Inject, Logger } from '@nestjs/common';
import {
  OriginalPosTransactionNotFoundException,
  PosDeviceNotFoundException,
  PosTransactionAlreadyReversedException,
  PosTransactionMissingExternalRefException,
  PosTransactionMissingPaymentDateException,
  PosTransactionNotVoidableException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { IyzicoTerminalVoidCommand } from './iyzico-terminal-void.command';
import type { IyzicoTerminalVoidResponse } from './iyzico-terminal-void.response';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { ResolveIyzicoTerminalCredentialsService } from '@modules/finance/pos/physical/application/services/resolve-iyzico-terminal-credentials.service';
import { IyzicoTerminalService } from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.service';
import {
  IYZICO_TERMINAL_RETRYABLE_GROUPS,
  IyzicoTerminalAuthError,
  IyzicoTerminalOperationError,
} from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.errors';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { IyzicoTerminalStatusSchema } from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.contracts';
import { extractIyzicoPaymentDate } from '@modules/finance/pos/physical/infrastructure/payment-gateway/iyzico-parser.utils';
import {
  IPosDeviceCommandRepository,
  POS_DEVICE_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { POS_EVENTS } from '@src/domain/constants/events';

@CommandHandler(IyzicoTerminalVoidCommand)
export class IyzicoTerminalVoidHandler implements ICommandHandler<
  IyzicoTerminalVoidCommand,
  IyzicoTerminalVoidResponse
> {
  private readonly logger = new Logger(IyzicoTerminalVoidHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionRepo: IPosTransactionCommandRepository,
    private readonly credentialsResolver: ResolveIyzicoTerminalCredentialsService,
    private readonly iyzicoTerminalService: IyzicoTerminalService,
    private readonly txManager: TransactionManager,
    private readonly posPaymentSync: PosPaymentSyncService,
    private readonly accountingBridge: PosAccountingBridgeService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(CARD_CHARGEBACK_EXPOSURE_GUARD)
    private readonly chargebackExposureGuard: ICardChargebackExposureGuard
  ) {}

  async execute(
    command: IyzicoTerminalVoidCommand
  ): Promise<IyzicoTerminalVoidResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const credentials = await this.credentialsResolver.resolve(input.clinicId);

    // Faz 1 — orijinal işlem KİLİT ALTINDA doğrulanır ve PENDING iptal kaydı aynı
    // transaction'da açılır (HTTP öncesi). Kilitli okuma, iptal kararını besleyen
    // durumu eşzamanlı değiştiricilerden (mutabakat, callback) yalıtır.
    const {
      voidTx,
      deviceUniqueId,
      paymentDate,
      originalPaymentId,
      originalPatientId,
      originalTransactionId,
      originalExternalRef,
    } = await this.txManager.outboxRun(async () => {
      const originalTx = await this.posTransactionRepo.findByIdForUpdate(
        input.originalPosTransactionId
      );
      if (!originalTx) {
        throw new OriginalPosTransactionNotFoundException();
      }

      // Yetki `input.clinicId` üzerinden verildi; ters kaydedilecek ORİJİNAL işlem
      // ayrı bir alandan geliyor. Bu doğrulama olmadan başka kliniğin satışı iptal
      // edilip para o kliniğin üye işyerinden geri döndürülebilirdi.
      originalTx.assertBelongsToClinic(input.clinicId);
      if (originalTx.status !== PosTransactionStatusSchema.enum.SUCCESS) {
        throw new PosTransactionNotVoidableException();
      }
      if (!originalTx.externalRef) {
        throw new PosTransactionMissingExternalRefException();
      }

      const paymentDate = extractIyzicoPaymentDate(originalTx.rawResponse);
      if (!paymentDate) {
        throw new PosTransactionMissingPaymentDateException();
      }

      // Satış zaten geri alınmışsa ikinci kez cihaza gidilmez. Kilit bu okumayı
      // eşzamanlı iptallerden yalıtır; yine de araya giren bir istek olursa
      // `active_void_original_id` unique kısıtı INSERT'te yakalar.
      const reversal = await this.posTransactionRepo.findLiveReversalSummary(
        originalTx.id.value
      );
      if (reversal.hasActiveVoid || reversal.refundedAmount.greaterThan(0)) {
        throw new PosTransactionAlreadyReversedException();
      }

      // İptal satışın TAMAMINI geri götürür: açık ya da kaybedilmiş bir kart
      // itirazı varsa aynı para iki kez (iptal + sağlayıcı kesintisi) gider.
      await this.chargebackExposureGuard.assertReversalWithinCollection({
        sourceType: CardChargebackSourceSchema.enum.POS_TRANSACTION,
        sourceId: originalTx.id.value,
        collectedAmount: originalTx.amount.value,
        alreadyReversedAmount: reversal.refundedAmount,
        requestedAmount: originalTx.amount.value,
      });

      const device = await this.posDeviceRepo.findById(originalTx.posDeviceId);
      if (!device || !device.isActive) {
        throw new PosDeviceNotFoundException();
      }

      const voidTx = await this.posTransactionRepo.create(
        PosTransaction.create({
          initiatedById: ctx.actor.userId,
          posDeviceId: device.id.value,
          clinicId: input.clinicId,
          paymentId: originalTx.paymentId ?? undefined,
          // Hasta bağı orijinal satıştan DEVRALINIR (bkz. pax ters kayıtları):
          // ters kayıt kendi satırı olduğu için bu kolon boş kalıyordu.
          patientId: originalTx.patientId?.value ?? undefined,
          amount: originalTx.amount.value.toNumber(),
          currency: originalTx.amount.currency,
          kind: PosTransactionKindSchema.enum.VOID,
          originalPosTransactionId: originalTx.id.value,
        })
      );

      return {
        voidTx,
        deviceUniqueId: device.iyzicoDeviceUniqueId.orThrow(),
        paymentDate,
        originalPaymentId: originalTx.paymentId,
        originalPatientId: originalTx.patientId?.value ?? null,
        originalTransactionId: originalTx.id.value,
        originalExternalRef: originalTx.externalRef,
      };
    });

    const voidTransactionId = voidTx.id.value;

    // Faz 2 — iyzico Terminal iptal çağrısı
    try {
      const result = await this.iyzicoTerminalService.voidPayment({
        credentials,
        deviceUniqueId,
        conversationId: voidTransactionId,
        transactionReferenceId: voidTransactionId,
        paymentId: originalExternalRef,
        paymentDate,
      });

      const approved =
        result.status === IyzicoTerminalStatusSchema.enum.SUCCESS;
      const externalRef = result.cancelHostReference ?? result.paymentId;

      // Faz 3 — sonuç + orijinal ödemeyi iade/iptal işaretle
      await this.txManager.outboxRun(async () => {
        if (approved) {
          voidTx.markSuccess(externalRef, result);
          await this.posTransactionRepo.update(voidTx);
          if (originalPaymentId) {
            await this.posPaymentSync.markRefunded({
              paymentId: originalPaymentId,
              clinicId: input.clinicId,
              // Tutar zorunlu: ters kaydın tutarına EŞİT taksit aranır. Önceden
              // ilk tamamlanmış taksit koşulsuz REFUNDED yapılıyordu — kısmi
              // iadede tüm taksit iade sayılıp ters kayıt fazla gelir düşürüyordu.
              amount: voidTx.amount.value,
              ctx,
            });
          }
          // Muhasebe köprüsü: kart iptalsi → 120 / 108 (bkz. pax ters kaydı).
          if (originalPatientId) {
            await this.accountingBridge.recordBestEffort({
              kind: 'REVERSAL',
              patientId: originalPatientId,
              clinicId: input.clinicId,
              amount: voidTx.amount.value,
              posTransactionId: voidTx.id.value,
              originalPosTransactionId: originalTransactionId,
            });
          }
        } else {
          voidTx.markFailed(result);
          await this.posTransactionRepo.update(voidTx);
        }
      });

      const status = approved
        ? PosTransactionStatusSchema.enum.SUCCESS
        : PosTransactionStatusSchema.enum.FAILED;

      this.logger.log(
        `iyzico terminal iptal tamamlandı: id=${voidTransactionId} status=${status}`
      );

      return {
        posTransactionId: voidTransactionId,
        status,
        approved,
        iyzicoPaymentId: approved ? externalRef : undefined,
        authCode: result.authCode,
        hostReference: result.hostReference,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };
    } catch (err) {
      if (
        err instanceof IyzicoTerminalOperationError &&
        IYZICO_TERMINAL_RETRYABLE_GROUPS.has(err.group)
      ) {
        this.logger.warn(
          `iyzico terminal iptal geçici hata (${err.group}): id=${voidTransactionId} — PENDING kalıyor`
        );
        return {
          posTransactionId: voidTransactionId,
          status: PosTransactionStatusSchema.enum.PENDING,
        };
      }

      if (
        err instanceof IyzicoTerminalOperationError ||
        err instanceof IyzicoTerminalAuthError
      ) {
        await this.txManager.outboxRun(async () => {
          voidTx.markFailed();
          await this.posTransactionRepo.update(voidTx);
        });
        this.logger.error(
          `iyzico terminal iptal hatası: id=${voidTransactionId} — ${err.message}`
        );
        return {
          posTransactionId: voidTransactionId,
          status: PosTransactionStatusSchema.enum.FAILED,
        };
      }

      throw err;
    }
  }
}
