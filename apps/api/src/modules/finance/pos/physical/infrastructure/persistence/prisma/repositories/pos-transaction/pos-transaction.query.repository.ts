import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  PosProvider,
  PosTransactionStatus,
} from '@prisma/client';
import { IPosTransactionQueryRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import {
  FindStalePosTransactionsFilter,
  FindBridgeablePosTransactionsFilter,
  ScanStalePosTransactionsParams,
  StalePosTransactionRow,
  BridgeablePosTransactionRow,
  PosTransactionSummary,
} from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import { normalizeReportDateRange } from '@modules/finance/shared/domain/reporting/report-date-range';

@Injectable()
export class PosTransactionQueryRepository
  extends BaseRepository
  implements IPosTransactionQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findSummaryById(id: string): Promise<PosTransactionSummary | null> {
    const row = await this.db.posTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        clinicId: true,
        kind: true,
        status: true,
        patientId: true,
        paymentId: true,
        amount: true,
        currency: true,
        completedAt: true,
        // Aynı modülün cihaz tablosu: bounded context sınırı içinde.
        posDevice: { select: { provider: true } },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      clinicId: row.clinicId,
      kind: row.kind,
      status: row.status,
      provider: row.posDevice.provider,
      patientId: row.patientId,
      paymentId: row.paymentId,
      amount: row.amount,
      currency: row.currency,
      completedAt: row.completedAt,
    };
  }

  /**
   * `paginate` kullanılmaz: bu bir sayfalı liste değil, operasyonun tamamını
   * görmesi gereken bir "askıda kalanlar" listesi (ve alarm taramasının girdisi).
   * Sağlayıcı filtresi YOKTUR — asıl riskli grup, durum sorgusu API'si olmayan
   * PAX dışı sağlayıcılardır.
   */
  async findStalePending(
    filter: FindStalePosTransactionsFilter
  ): Promise<StalePosTransactionRow[]> {
    const cutoff = new Date(Date.now() - filter.olderThanMinutes * 60_000);

    const rows = await this.db.posTransaction.findMany({
      where: {
        clinicId: filter.clinicId,
        status: PosTransactionStatus.PENDING,
        initiatedAt: { lt: cutoff },
      },
      orderBy: { initiatedAt: 'asc' },
      select: {
        id: true,
        clinicId: true,
        posDeviceId: true,
        amount: true,
        currency: true,
        kind: true,
        paymentId: true,
        initiatedAt: true,
        posDevice: { select: { provider: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      clinicId: row.clinicId,
      posDeviceId: row.posDeviceId,
      provider: row.posDevice.provider,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      paymentId: row.paymentId,
      initiatedAt: row.initiatedAt,
    }));
  }

  async findStalePendingAnyClinic(
    params: ScanStalePosTransactionsParams
  ): Promise<StalePosTransactionRow[]> {
    const cutoff = new Date(Date.now() - params.olderThanMinutes * 60_000);

    const rows = await this.db.posTransaction.findMany({
      where: {
        status: PosTransactionStatus.PENDING,
        initiatedAt: { lt: cutoff },
        ...(params.excludeProviders.length > 0
          ? {
              posDevice: {
                provider: {
                  notIn: params.excludeProviders as PosProvider[],
                },
              },
            }
          : {}),
      },
      orderBy: { initiatedAt: 'asc' },
      select: {
        id: true,
        clinicId: true,
        posDeviceId: true,
        amount: true,
        currency: true,
        kind: true,
        paymentId: true,
        initiatedAt: true,
        posDevice: { select: { provider: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      clinicId: row.clinicId,
      posDeviceId: row.posDeviceId,
      provider: row.posDevice.provider,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      paymentId: row.paymentId,
      initiatedAt: row.initiatedAt,
    }));
  }

  async findSuccessfulBridgeable(
    filter: FindBridgeablePosTransactionsFilter
  ): Promise<BridgeablePosTransactionRow[]> {
    // Hem köprülenmemiş işlem raporu hem telafi komutu bu pencereden geçiyor:
    // ham `lte` ile son günün POS tahsilatı ne listelenir ne onarılır.
    const { dateFrom, dateTo } = normalizeReportDateRange({
      dateFrom: filter.from,
      dateTo: filter.to,
    });

    const rows = await this.db.posTransaction.findMany({
      where: {
        clinicId: filter.clinicId,
        status: PosTransactionStatus.SUCCESS,
        // `kind: SALE` süzgeci KALDIRILDI: iptal/iade de köprülenir
        // (PAYMENT_REFUNDED) ve köprüsü best-effort olduğu için eksik kalanı
        // listelenebilmek zorunda.
        // Köprü yalnız cari sahibi (hasta) olan hareket için kurulur.
        patientId: { not: null },
        completedAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        amount: true,
        currency: true,
        completedAt: true,
        kind: true,
        originalPosTransactionId: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      clinicId: row.clinicId,
      patientId: row.patientId as string,
      amount: row.amount,
      currency: row.currency,
      completedAt: row.completedAt,
      kind: row.kind,
      originalPosTransactionId: row.originalPosTransactionId,
    }));
  }
}
