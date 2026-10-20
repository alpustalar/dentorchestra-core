import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FINANCE_JOBS, QUEUES } from '@common/constants';

/**
 * Cari kaydı tetikleyen olayın türü. İşin `jobId`'sine girer: aynı olayın
 * tekrar teslimi aynı işi üretir (dedupe), ama tahsilat ile iade **ayrı**
 * işlerdir — tek bir `jobId` kullanmak, tahsilat işi kuyrukta beklerken gelen
 * iade işini sessizce yok sayardı.
 */
export type LedgerSyncReason = 'PAID' | 'REFUNDED' | 'CHARGED_BACK';

/**
 * İşin yükü yalnız kimliklerden oluşur: tutar/para birimi/durum kaydın
 * yazıldığı anda kaynaktan (payment modülü) okunur. Daha önce tutar kuyruğa
 * girerken kopyalanıyordu; iş gecikir ya da yeniden denenirse bayat veriyle
 * yazılma riski vardı ve dinleyici bu yüzden başka modülün tablolarını
 * doğrudan okumak zorunda kalıyordu.
 */
export interface ILedgerJobData {
  installmentId: string;
  paymentId: string;
  clinicId: string;
  reason: LedgerSyncReason;
  /** Olayı doğuran personel — kaydın `performedById` damgası. */
  actorId: string | null;
}

@Injectable()
export class FinanceLedgerProducer {
  constructor(
    @InjectQueue(QUEUES.FINANCE) private readonly ledgerQueue: Queue
  ) {}

  async addToLedgerQueue(data: ILedgerJobData): Promise<void> {
    await this.ledgerQueue.add(FINANCE_JOBS.PROCESS_LEDGER, data, {
      jobId: `ledger-sync:${data.installmentId}:${data.reason}`,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      // Başarısız iş SİLİNMEZ: 5 denemeden sonra elde kalan tek görünür iz
      // odur. Mutabakat sorgusu (`FindLedgerMismatchesQuery`) eksikleri
      // bağımsız olarak da gösterir.
      removeOnFail: false,
    });
  }
}
