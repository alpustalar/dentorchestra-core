import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ReconcilePosTransactionsCommand } from './reconcile-pos-transactions.command';
import {
  IPosTransactionCommandRepository,
  POS_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import {
  IPosTransactionQueryRepository,
  POS_TRANSACTION_QUERY_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { PosProvider } from '@prisma/client';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';

const GRACE_PERIOD_MS = 3 * 60 * 1000; // 3 dk — in-flight işlemleri atla
const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 saat — TIMEOUT olarak işaretle
const STALE_THRESHOLD_MINUTES = STALE_THRESHOLD_MS / 60_000;

@CommandHandler(ReconcilePosTransactionsCommand)
export class ReconcilePosTransactionsHandler implements ICommandHandler<
  ReconcilePosTransactionsCommand,
  void
> {
  private readonly logger = new Logger(ReconcilePosTransactionsHandler.name);

  constructor(
    @Inject(POS_TRANSACTION_COMMAND_REPOSITORY)
    private readonly posTransactionCommandRepo: IPosTransactionCommandRepository,
    @Inject(POS_TRANSACTION_QUERY_REPOSITORY)
    private readonly posTransactionQueryRepo: IPosTransactionQueryRepository,
    private readonly paxService: PaxService,
    private readonly txManager: TransactionManager,
    private readonly posPaymentSync: PosPaymentSyncService,
    private readonly accountingBridge: PosAccountingBridgeService,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(): Promise<void> {
    await this.reconcilePaxTransactions();
    await this.reportUnverifiableTransactions();
  }

  /**
   * PAX işlemleri: cihaza durum sorulur (T05), sonuç bulunursa işlem
   * sonuçlandırılır. `findPendingForReconcile` yalnız PAX cihazlarını döner —
   * TCP durum sorgusu PAX'a özgüdür.
   */
  private async reconcilePaxTransactions(): Promise<void> {
    const pending =
      await this.posTransactionCommandRepo.findPendingForReconcile(
        GRACE_PERIOD_MS
      );

    if (pending.length === 0) return;

    this.logger.log(
      `Reconcile döngüsü başladı. Bulunan PENDING işlem sayısı: ${pending.length}`
    );

    const now = Date.now();

    for (const tx of pending) {
      const ageMs = now - tx.initiatedAt.getTime();

      if (ageMs > STALE_THRESHOLD_MS) {
        await this.timeoutStaleTransaction(tx.id, tx.clinicId, ageMs);
        continue;
      }

      try {
        const result = await this.paxService.queryTransactionStatus({
          device: tx.device,
          ecReferenceNumber: tx.id,
        });

        if (!result) {
          this.logger.verbose(
            `POS cihazından durum yanıtı alınamadı veya T05 desteklenmiyor: id=${tx.id}`
          );
          continue;
        }

        await this.settleFromDeviceResult(tx.id, result);
        this.logger.log(`POS işlem reconcile edildi: id=${tx.id}`);
      } catch (err) {
        this.logger.error(
          `POS reconcile işlemi sırasında beklenmeyen hata fırlatıldı: id=${tx.id}`,
          (err as Error).stack
        );
        // Tarama bir sonraki işleme geçiyor; bu işlem PENDING'de asılı kalır.
        // Kart çekilmiş olabilir — kimse bakmazsa ne tahsilat ne iade görünür.
        this.criticalFailure.publish({
          operation: 'finance.pos.reconcile',
          severity: 'CRITICAL',
          summary: 'POS işlemi mutabakatta sonuçlandırılamadı; PENDING kaldı.',
          errorMessage: err instanceof Error ? err.message : String(err),
          context: { posTransactionId: tx.id },
          clinicId: tx.clinicId,
          dedupeKey: `pos-reconcile-failed:${tx.id}`,
        });
      }
    }
  }

  /**
   * Cihaza sorulamayan sağlayıcılar (iyzico Terminal) için **görünürlük**.
   *
   * Bu işlemler mutabakat döngüsüne hiç girmiyordu: satış handler'ı geçici
   * hatada "PENDING kalıyor — reconcile/manuel" diyor ama reconcile yalnız PAX
   * tarıyor. Sonuç: kart çekilmiş olabilecek bir işlem sonsuza dek PENDING
   * kalıyor, ödeme taksiti açık görünüyor, deftere hiçbir şey düşmüyor ve
   * **hiçbir alarm çıkmıyordu**. Sağlayıcıda durum sorgusu API'si olmadığı için
   * tek doğru davranış: otomatik karar vermemek, ama görünür kılmak
   * (alarm + `GET /pos/transactions/stale-pending`).
   */
  private async reportUnverifiableTransactions(): Promise<void> {
    const stale = await this.posTransactionQueryRepo.findStalePendingAnyClinic({
      olderThanMinutes: STALE_THRESHOLD_MINUTES,
      excludeProviders: [PosProvider.PAX],
    });

    for (const tx of stale) {
      this.logger.warn(
        `Doğrulanamayan askıda POS işlemi: id=${tx.id} sağlayıcı=${tx.provider} süre=${Math.round(
          (Date.now() - tx.initiatedAt.getTime()) / 60_000
        )}dk`
      );
      this.criticalFailure.publish({
        operation: 'finance.pos.unverifiable-pending',
        severity: 'CRITICAL',
        summary:
          'POS işlemi askıda kaldı ve sağlayıcıda durum sorgusu yok — elle doğrulanmalı.',
        errorMessage: `provider=${tx.provider} amount=${tx.amount.toString()} ${tx.currency}`,
        context: {
          posTransactionId: tx.id,
          provider: tx.provider,
          paymentId: tx.paymentId,
        },
        clinicId: tx.clinicId,
        dedupeKey: `pos-unverifiable-pending:${tx.id}`,
      });
    }
  }

  /**
   * Yaşı eşiği aşan PAX işlemini TIMEOUT'a düşürür.
   *
   * ⚠️ Bu karar cihaza **sorulmadan** verilir (sorgu başarısız olduğu ya da
   * desteklenmediği için buraya gelindi): kart çekilmiş olabilir. Önceden
   * yalnız `logger.warn` yazılıyordu — yani kimsenin görmediği bir yerde para
   * kayboluyordu. Artık CRITICAL alarm üretilir.
   */
  private async timeoutStaleTransaction(
    posTransactionId: string,
    clinicId: string,
    ageMs: number
  ): Promise<void> {
    await this.txManager.outboxRun(async () => {
      const entity =
        await this.posTransactionCommandRepo.findByIdForUpdate(
          posTransactionId
        );
      if (!entity) return;
      if (!entity.validate.status.isPending().value) return;

      entity.markTimeout();
      await this.posTransactionCommandRepo.update(entity);
    });

    const ageMinutes = Math.round(ageMs / 60_000);
    this.logger.warn(
      `POS işlem TIMEOUT: id=${posTransactionId} süre=${ageMinutes}dk — manuel inceleme gerekebilir`
    );
    this.criticalFailure.publish({
      operation: 'finance.pos.blind-timeout',
      severity: 'CRITICAL',
      summary:
        'POS işlemi cihaza sorulamadan TIMEOUT işaretlendi; kart çekilmiş olabilir.',
      errorMessage: `ageMinutes=${ageMinutes}`,
      context: { posTransactionId, ageMinutes },
      clinicId,
      dedupeKey: `pos-blind-timeout:${posTransactionId}`,
    });
  }

  /** Cihazdan dönen sonucu kilit altında işler (callback ile yarışır). */
  private async settleFromDeviceResult(
    posTransactionId: string,
    result: { approved: boolean; externalRef?: string; rawResponse?: unknown }
  ): Promise<void> {
    await this.txManager.outboxRun(async () => {
      // Kilitli ve taze okuma: PAX sorgusu sürerken cihaz callback'i aynı
      // işlemi sonuçlandırmış olabilir. Kilit sayesinde entity'nin "yalnız
      // PENDING'den geçiş" invariant'ı gerçekten devreye girer — kilitsizken
      // iki akış da PENDING görüp ödemeyi iki kez işaretleyebilirdi.
      const entity =
        await this.posTransactionCommandRepo.findByIdForUpdate(
          posTransactionId
        );
      if (!entity) return;

      // Kilidi beklerken cihaz callback'i işlemi sonuçlandırmış olabilir.
      // Entity "yalnız PENDING'den geçiş"i zorladığı için burada sessizce
      // atlanır ki tarama hata fırlatmasın.
      if (!entity.validate.status.isPending().value) return;

      const ctx = ExecutionContextFactory.createInternal();

      if (result.approved) {
        entity.markSuccess(result.externalRef, result.rawResponse);
        await this.posTransactionCommandRepo.update(entity);

        // İşlem TÜRÜNE göre ayrışır. Bu dal eskiden tür-kördü: cihaza
        // sorulamadığı için PENDING kalmış bir **iade** sonradan onaylandığında
        // taksit `markPaid` ile TAHSİL EDİLDİ işaretleniyor ve deftere ikinci
        // bir PAYMENT_RECEIVED yazılıyordu — para üye işyerinden çıkmışken
        // kayıtlar bir tahsilat daha gösteriyordu (iade ise hiç yazılmıyordu).
        const isReversal = entity.kind !== PosTransactionKindSchema.enum.SALE;

        if (entity.paymentId) {
          const sync = {
            paymentId: entity.paymentId,
            clinicId: entity.clinicId.value,
            amount: entity.amount.value,
            ctx,
          };
          await (isReversal
            ? this.posPaymentSync.markRefunded(sync)
            : this.posPaymentSync.markPaid(sync));
        }
        // Muhasebe köprüsü: senkron akış timeout/PENDING kaldığı için olayı
        // üretemedi; reconcile başarıyı bulunca aynı dedupeKey ile üretir
        // (satış → 108/120, ters kayıt → 120/108).
        if (entity.patientId) {
          await this.accountingBridge.recordBestEffort({
            kind: isReversal ? 'REVERSAL' : 'SALE',
            patientId: entity.patientId.value,
            clinicId: entity.clinicId.value,
            amount: entity.amount.value,
            posTransactionId: entity.id.value,
            originalPosTransactionId:
              entity.originalPosTransactionId ?? undefined,
          });
        }
        return;
      }

      entity.markFailed(result.rawResponse);
      await this.posTransactionCommandRepo.update(entity);

      if (entity.paymentId) {
        await this.posPaymentSync.markFailed({
          paymentId: entity.paymentId,
          clinicId: entity.clinicId.value,
          amount: entity.amount.value,
          ctx,
        });
      }
    });
  }
}
