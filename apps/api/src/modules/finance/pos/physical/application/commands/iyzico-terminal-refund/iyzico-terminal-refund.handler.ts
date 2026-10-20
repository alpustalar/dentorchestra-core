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
  PosTransactionNotRefundableException,
  RefundAmountExceedsOriginalException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { IyzicoTerminalRefundCommand } from './iyzico-terminal-refund.command';
import type { IyzicoTerminalRefundResponse } from './iyzico-terminal-refund.response';
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
import { Decimal } from 'decimal.js';
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

@CommandHandler(IyzicoTerminalRefundCommand)
export class IyzicoTerminalRefundHandler implements ICommandHandler<
  IyzicoTerminalRefundCommand,
  IyzicoTerminalRefundResponse
> {
  private readonly logger = new Logger(IyzicoTerminalRefundHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionCommandRepo: IPosTransactionCommandRepository,
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
    command: IyzicoTerminalRefundCommand
  ): Promise<IyzicoTerminalRefundResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    const credentials = await this.credentialsResolver.resolve(input.clinicId);

    // Faz 1 — orijinal işlem KİLİT ALTINDA doğrulanır ve PENDING iade kaydı aynı
    // transaction'da açılır (HTTP öncesi). Kilitli okuma, iade kararını besleyen
    // durumu eşzamanlı değiştiricilerden (mutabakat, callback) yalıtır.
    const {
      refundTx,
      deviceUniqueId,
      paymentDate,
      refundAmount,
      originalPaymentId,
      originalPatientId,
      originalTransactionId,
      originalExternalRef,
    } = await this.txManager.outboxRun(async () => {
      const originalTx = await this.posTransactionCommandRepo.findByIdForUpdate(
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
        throw new PosTransactionNotRefundableException();
      }
      if (!originalTx.externalRef) {
        throw new PosTransactionMissingExternalRefException();
      }

      const paymentDate = extractIyzicoPaymentDate(originalTx.rawResponse);
      if (!paymentDate) {
        throw new PosTransactionMissingPaymentDateException();
      }

      const originalAmount = originalTx.amount.value;
      const refundAmount = new Decimal(input.amount ?? originalAmount);

      // İade kısmi olabildiği için kontrol KÜMÜLATİF: daha önce iade edilenlerle
      // birlikte satış tutarı aşılamaz. Tek tek bakmak, art arda gelen iki tam
      // iadenin ikisinin de geçmesine izin verirdi. Okuma orijinal satır kilitliyken
      // yapıldığı için eşzamanlı iadeler sıraya girer.
      const reversal =
        await this.posTransactionCommandRepo.findLiveReversalSummary(
          originalTx.id.value
        );
      if (reversal.hasActiveVoid) {
        throw new PosTransactionAlreadyReversedException();
      }
      if (
        reversal.refundedAmount.plus(refundAmount).greaterThan(originalAmount)
      ) {
        throw new RefundAmountExceedsOriginalException();
      }

      // Kart itirazı da aynı satışın aynı tutarına dokunur: iade + aktif
      // itirazlar satışı aşarsa kart sahibine para İKİ KEZ gider (bir kez
      // sağlayıcı kesintisi, bir kez bizim iademiz).
      await this.chargebackExposureGuard.assertReversalWithinCollection({
        sourceType: CardChargebackSourceSchema.enum.POS_TRANSACTION,
        sourceId: originalTx.id.value,
        collectedAmount: originalAmount,
        alreadyReversedAmount: reversal.refundedAmount,
        requestedAmount: refundAmount,
      });

      const device = await this.posDeviceRepo.findById(originalTx.posDeviceId);
      if (!device) {
        throw new PosDeviceNotFoundException();
      }

      device.validate.status.isActive.orThrow();

      const refundTx = await this.posTransactionCommandRepo.create(
        PosTransaction.create({
          initiatedById: ctx.actor.userId,
          posDeviceId: device.id.value,
          clinicId: input.clinicId,
          paymentId: originalTx.paymentId ?? undefined,
          // Hasta bağı orijinal satıştan DEVRALINIR (bkz. pax ters kayıtları):
          // ters kayıt kendi satırı olduğu için bu kolon boş kalıyordu.
          patientId: originalTx.patientId?.value ?? undefined,
          amount: refundAmount.toNumber(),
          currency: originalTx.amount.currency,
          kind: PosTransactionKindSchema.enum.REFUND,
          originalPosTransactionId: originalTx.id.value,
        })
      );

      return {
        refundTx,
        deviceUniqueId: device.iyzicoDeviceUniqueId.orThrow(),
        paymentDate,
        refundAmount: refundAmount.toNumber(),
        originalPaymentId: originalTx.paymentId,
        originalPatientId: originalTx.patientId?.value ?? null,
        originalTransactionId: originalTx.id.value,
        originalExternalRef: originalTx.externalRef,
      };
    });

    const refundTransactionId = refundTx.id.value;

    // Faz 2 — iyzico Terminal iade çağrısı (transaction dışında)
    try {
      const result = await this.iyzicoTerminalService.refundPayment({
        credentials,
        deviceUniqueId,
        conversationId: refundTransactionId,
        transactionReferenceId: refundTransactionId,
        paymentId: originalExternalRef,
        price: refundAmount,
        paymentDate,
      });

      const approved =
        result.status === IyzicoTerminalStatusSchema.enum.SUCCESS;

      const externalRef = result.refundHostReference ?? result.paymentId;

      // Faz 3 — sonuç + orijinal ödemeyi iade işaretle atomik (outboxRun)
      await this.txManager.outboxRun(async () => {
        if (approved) {
          refundTx.markSuccess(externalRef, result);
          await this.posTransactionCommandRepo.update(refundTx);
          if (originalPaymentId) {
            await this.posPaymentSync.markRefunded({
              paymentId: originalPaymentId,
              clinicId: input.clinicId,
              // Tutar zorunlu: ters kaydın tutarına EŞİT taksit aranır. Önceden
              // ilk tamamlanmış taksit koşulsuz REFUNDED yapılıyordu — kısmi
              // iadede tüm taksit iade sayılıp ters kayıt fazla gelir düşürüyordu.
              amount: refundTx.amount.value,
              ctx,
            });
          }
          // Muhasebe köprüsü: kart iadesi → 120 / 108 (bkz. pax ters kaydı).
          if (originalPatientId) {
            await this.accountingBridge.recordBestEffort({
              kind: 'REVERSAL',
              patientId: originalPatientId,
              clinicId: input.clinicId,
              amount: refundTx.amount.value,
              posTransactionId: refundTx.id.value,
              originalPosTransactionId: originalTransactionId,
            });
          }
        } else {
          refundTx.markFailed(result);
          await this.posTransactionCommandRepo.update(refundTx);
        }
      });

      const status = approved
        ? PosTransactionStatusSchema.enum.SUCCESS
        : PosTransactionStatusSchema.enum.FAILED;

      this.logger.log(
        `iyzico terminal iade tamamlandı: id=${refundTransactionId} status=${status}`
      );

      return {
        posTransactionId: refundTransactionId,
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
          `iyzico terminal iade geçici hata (${err.group}): id=${refundTransactionId} — PENDING kalıyor`
        );
        return {
          posTransactionId: refundTransactionId,
          status: PosTransactionStatusSchema.enum.PENDING,
        };
      }

      if (
        err instanceof IyzicoTerminalOperationError ||
        err instanceof IyzicoTerminalAuthError
      ) {
        await this.txManager.outboxRun(async () => {
          refundTx.markFailed();
          await this.posTransactionCommandRepo.update(refundTx);
        });
        this.logger.error(
          `iyzico terminal iade hatası: id=${refundTransactionId} — ${err.message}`
        );
        return {
          posTransactionId: refundTransactionId,
          status: PosTransactionStatusSchema.enum.FAILED,
        };
      }

      throw err;
    }
  }
}
