import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  OriginalPosTransactionNotFoundException,
  PosDeviceNotFoundException,
  PosTransactionAlreadyReversedException,
  PosTransactionMissingExternalRefException,
  PosTransactionNotVoidableException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxVoidCommand } from './pax-void.command';
import type { PaxVoidResponse } from './pax-void.response';
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

@CommandHandler(PaxVoidCommand)
export class PaxVoidHandler implements ICommandHandler<
  PaxVoidCommand,
  PaxVoidResponse
> {
  private readonly logger = new Logger(PaxVoidHandler.name);

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

  async execute(command: PaxVoidCommand): Promise<PaxVoidResponse> {
    const { input, ctx } = command;

    // `clinicId` istek gövdesinden geliyor — aktörün kendi kliniği DEĞİL. Bu
    // kontrol olmadan, POS yetkisi olan herhangi bir personel gövdeye başka bir
    // kliniğin id'sini yazıp o kliniğin terminalinde işlem yürütebilirdi.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(input.clinicId))
      .orThrow(POS_EVENTS.TRANSACTION_INITIATED);

    // Faz 1 — orijinal işlem KİLİT ALTINDA doğrulanır ve PENDING void kaydı aynı
    // transaction'da açılır (TCP öncesi). Kilitli okuma, iptal kararını besleyen
    // durumu eşzamanlı değiştiricilerden (mutabakat taraması, cihaz callback'i)
    // yalıtır; kilitsiz okumada "SUCCESS" görülüp iptal edilen işlem aslında bu
    // arada TIMEOUT'a düşmüş olabilirdi.
    const {
      voidTx,
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

        originalTx.validate.status
          .isSuccess(new PosTransactionNotVoidableException())
          .orThrow();

        const originalExternalRef = originalTx.validate.has
          .externalRef(new PosTransactionMissingExternalRefException())
          .orThrow();

        // Satış zaten geri alınmışsa ikinci kez cihaza gidilmez. Kilit bu okumayı
        // eşzamanlı iptallerden yalıtır; yine de araya giren bir istek olursa
        // `active_void_original_id` unique kısıtı INSERT'te yakalar.
        const reversal = await this.posTransactionRepo.findLiveReversalSummary(
          originalTx.id.value
        );
        if (reversal.hasActiveVoid || reversal.refundedAmount.greaterThan(0)) {
          throw new PosTransactionAlreadyReversedException();
        }

        const device = await this.posDeviceRepo.findById(
          originalTx.posDeviceId
        );
        if (!device) {
          throw new PosDeviceNotFoundException();
        }

        device.validate.status.isActive.orThrow();

        const voidTx = await this.posTransactionRepo.create(
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
            amount: originalTx.amount.value.toNumber(),
            currency: originalTx.amount.currency,
            kind: PosTransactionKindSchema.enum.VOID,
            originalPosTransactionId: originalTx.id.value,
          })
        );

        return {
          voidTx,
          device,
          originalPaymentId: originalTx.paymentId,
          originalPatientId: originalTx.patientId?.value ?? null,
          originalTransactionId: originalTx.id.value,
          originalExternalRef,
        };
      });

    // ECR referansı ve dönen kimlik, DB'ye yazılan void kaydının id'sidir: mutabakat
    // taraması ve çağıranın sorgusu bu id üzerinden yürür.
    const voidTransactionId = voidTx.id.value;

    // Faz 2 — PAX TCP çağrısı (transaction dışında)
    try {
      const result = await this.paxService.void({
        device: device.getPaxConnection(),
        amountInMinorUnits: voidTx.amount.value.times(100).round().toNumber(),
        ecReferenceNumber: voidTransactionId,
        originalReferenceNumber: originalExternalRef,
      });

      // Faz 3 — sonuç + orijinal ödemeyi iade işaretle + ledger atomik (outboxRun)
      await this.txManager.outboxRun(async () => {
        if (result.approved) {
          voidTx.markSuccess(result.externalRef, result.rawResponse);
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
          // Muhasebe köprüsü: kart iptalsi → 120 / 108. Bu yarısı HİÇ YOKTU:
          // taksit REFUNDED oluyor, cari defter düzeliyor ama yevmiyede tahsilat
          // olduğu gibi kalıyordu (108'de hiç gelmeyecek para, 120'de kapanmış
          // görünen borç).
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
          voidTx.markFailed(result.rawResponse);
          await this.posTransactionRepo.update(voidTx);
        }
      });

      const status = result.approved
        ? PosTransactionStatusSchema.enum.SUCCESS
        : PosTransactionStatusSchema.enum.FAILED;

      this.logger.log(
        `PAX void tamamlandı: id=${voidTransactionId} status=${status}`
      );

      return {
        posTransactionId: voidTransactionId,
        status,
        approved: result.approved,
        responseText: result.responseText,
        externalRef: result.externalRef,
      };
    } catch (err) {
      if (err instanceof PaxTimeoutError) {
        this.logger.warn(
          `PAX void timeout: id=${voidTransactionId} — PENDING kalıyor`
        );
        return { posTransactionId: voidTransactionId, status: 'PENDING' };
      }

      if (err instanceof PaxConnectionError) {
        await this.txManager.run(async () => {
          voidTx.markFailed();
          await this.posTransactionRepo.update(voidTx);
        });
        this.logger.error(`PAX void bağlantı hatası: id=${voidTransactionId}`);
        return { posTransactionId: voidTransactionId, status: 'FAILED' };
      }

      throw err;
    }
  }
}
