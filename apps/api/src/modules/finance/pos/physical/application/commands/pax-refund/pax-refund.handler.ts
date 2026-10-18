import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  OriginalPosTransactionNotFoundException,
  PosDeviceNotFoundException,
  PosTransactionAlreadyReversedException,
  PosTransactionMissingExternalRefException,
  PosTransactionNotRefundableException,
  RefundAmountExceedsOriginalException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxRefundCommand } from './pax-refund.command';
import type { PaxRefundResponse } from './pax-refund.response';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import {
  PaxConnectionError,
  PaxTimeoutError,
} from '@src/infrastructure/payment/pos/physical/providers/pax/pax.errors';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import { Decimal } from 'decimal.js';
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

@CommandHandler(PaxRefundCommand)
export class PaxRefundHandler implements ICommandHandler<
  PaxRefundCommand,
  PaxRefundResponse
> {
  private readonly logger = new Logger(PaxRefundHandler.name);

  constructor(
    @Inject(POS_DEVICE_COMMAND_REPOSITORY)
    private readonly posDeviceRepo: IPosDeviceCommandRepository,
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionRepo: IPosTransactionCommandRepository,
    private readonly paxService: PaxService,
    private readonly txManager: TransactionManager,
    private readonly posPaymentSync: PosPaymentSyncService,
    private readonly accountingBridge: PosAccountingBridgeService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(command: PaxRefundCommand): Promise<PaxRefundResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    // Faz 1 — orijinal işlem KİLİT ALTINDA doğrulanır ve PENDING iade kaydı aynı
    // transaction'da açılır (TCP öncesi). Kilitli okuma, iade kararını besleyen
    // durumu eşzamanlı değiştiricilerden (mutabakat taraması, cihaz callback'i) yalıtır.
    const {
      refundTx,
      device,
      originalPaymentId,
      originalPatientId,
      originalTransactionId,
      originalExternalRef,
    } =
      await this.txManager.outboxRun(async () => {
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
          throw new PosTransactionNotRefundableException();
        }
        if (!originalTx.externalRef) {
          throw new PosTransactionMissingExternalRefException();
        }

        const originalAmount = originalTx.amount.value;
        const refundAmount = new Decimal(input.amount ?? originalAmount);

        // İade kısmi olabildiği için kontrol KÜMÜLATİF: daha önce iade edilenlerle
        // birlikte satış tutarı aşılamaz. Tek tek bakmak, art arda gelen iki tam
        // iadenin ikisinin de geçmesine izin verirdi. Okuma orijinal satır kilitliyken
        // yapıldığı için eşzamanlı iadeler sıraya girer.
        const reversal = await this.posTransactionRepo.findLiveReversalSummary(
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

        const device = await this.posDeviceRepo.findById(
          originalTx.posDeviceId
        );
        if (!device) {
          throw new PosDeviceNotFoundException();
        }

        device.validate.status.isActive.orThrow();

        const refundTx = await this.posTransactionRepo.create(
          PosTransaction.create({
            initiatedById: ctx.actor.userId,
            posDeviceId: device.id.value,
            clinicId: input.clinicId,
            paymentId: originalTx.paymentId ?? undefined,
            // Hasta bağı orijinal satıştan DEVRALINIR: ters kayıt kendi satırı
            // olduğu için bu kolon boş kalıyordu ve "kim iade edildi" ancak
            // orijinale join atarak bulunabiliyordu. Muhasebe köprüsü de cariyi
            // buradan çözüyor.
            patientId: originalTx.patientId?.value ?? undefined,
            amount: refundAmount.toNumber(),
            currency: originalTx.amount.currency,
            kind: PosTransactionKindSchema.enum.REFUND,
            originalPosTransactionId: originalTx.id.value,
          })
        );

        return {
          refundTx,
          device,
          originalPaymentId: originalTx.paymentId,
          originalPatientId: originalTx.patientId?.value ?? null,
          originalTransactionId: originalTx.id.value,
          originalExternalRef: originalTx.externalRef,
        };
      });

    // ECR referansı ve dönen kimlik, DB'ye yazılan iade kaydının id'sidir: mutabakat
    // taraması ve çağıranın sorgusu bu id üzerinden yürür.
    const refundTransactionId = refundTx.id.value;

    // Faz 2 — PAX TCP çağrısı (transaction dışında)
    try {
      const result = await this.paxService.refund({
        device: device.getPaxConnection(),
        amountInMinorUnits: refundTx.amount.value.times(100).round().toNumber(),
        ecReferenceNumber: refundTransactionId,
        originalReferenceNumber: originalExternalRef,
      });

      // Faz 3 — sonuç + orijinal ödemeyi iade işaretle + ledger atomik (outboxRun)
      await this.txManager.outboxRun(async () => {
        if (result.approved) {
          refundTx.markSuccess(result.externalRef, result.rawResponse);
          await this.posTransactionRepo.update(refundTx);
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
          // Muhasebe köprüsü: kart iadesi → 120 / 108. Bu yarısı HİÇ YOKTU:
          // taksit REFUNDED oluyor, cari defter düzeliyor ama yevmiyede tahsilat
          // olduğu gibi kalıyordu (108'de hiç gelmeyecek para, 120'de kapanmış
          // görünen borç).
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
          refundTx.markFailed(result.rawResponse);
          await this.posTransactionRepo.update(refundTx);
        }
      });

      const status = result.approved
        ? PosTransactionStatusSchema.enum.SUCCESS
        : PosTransactionStatusSchema.enum.FAILED;

      this.logger.log(
        `PAX iade tamamlandı: id=${refundTransactionId} status=${status}`
      );

      return {
        posTransactionId: refundTransactionId,
        status,
        approved: result.approved,
        responseText: result.responseText,
        authorizationCode: result.authorizationCode,
        externalRef: result.externalRef,
      };
    } catch (err) {
      if (err instanceof PaxTimeoutError) {
        this.logger.warn(
          `PAX iade timeout: id=${refundTransactionId} — PENDING kalıyor`
        );
        return { posTransactionId: refundTransactionId, status: 'PENDING' };
      }

      if (err instanceof PaxConnectionError) {
        await this.txManager.run(async () => {
          refundTx.markFailed();
          await this.posTransactionRepo.update(refundTx);
        });
        this.logger.error(
          `PAX iade bağlantı hatası: id=${refundTransactionId}`
        );
        return { posTransactionId: refundTransactionId, status: 'FAILED' };
      }

      throw err;
    }
  }
}
