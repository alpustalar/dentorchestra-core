import { Injectable } from '@nestjs/common';
import {
  Currency,
  FinanceLedger,
  LedgerType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { FinanceLedger as IFinanceLedger, Pagination } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  GetSummaryFilter,
  LedgerCurrencyTotal,
  LedgerEntryStatusRow,
  LedgerSummary,
  PatientCurrencyBalance,
  PatientFinanceSummary,
  PatientLedgerItem,
  PatientRevenue,
  SumIncomeByPatientsFilter,
} from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';
import { IFinanceLedgerQueryRepository } from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.query.repository';
import { Paginated } from '@common/interfaces/paginated.type';
import { normalizeReportDateRange } from '@modules/finance/shared/domain/reporting/report-date-range';

/**
 * Hastanın "hizmet tutarı" sayılan ödeme planı durumları.
 *
 * CANCELLED ve FAILED dışında REFUNDED de hariçtir: iade edilmiş bir plan
 * hastanın borcu değildir. Tahsilat tarafı (defter) iadeyi düşürdüğü için
 * planı düşürmemek, iade edilen tutarı hastaya **yeniden borç** yazıyordu.
 * Kısmi iadede plan REFUNDED olmaz (PARTIAL kalır), o yüzden bu hariç tutma
 * yalnız tamamı iade edilmiş planları etkiler.
 */
const SERVICE_AMOUNT_EXCLUDED_PAYMENT_STATUSES = [
  PaymentStatus.CANCELLED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
];

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class FinanceLedgerQueryRepository
  extends BaseRepository
  implements IFinanceLedgerQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findManyByClinicId(
    clinicId: string,
    pagination: Pagination
  ): Promise<Paginated<IFinanceLedger>> {
    return paginate({
      delegate: this.db.financeLedger,
      pagination,
      where: { clinicId },
    });
  }

  async findManyByPatientIdWithDetails(
    patientId: string,
    pagination: Pagination
  ): Promise<Paginated<PatientLedgerItem>> {
    type RawRow = {
      id: string;
      amount: Prisma.Decimal;
      currency: Currency;
      category: FinanceLedger['category'];
      entryDate: Date;
      status: FinanceLedger['status'];
      description: string | null;
      payment: {
        method: PaymentMethod;
        provider: { name: string } | null;
      } | null;
    };

    const result = (await paginate({
      delegate: this.db.financeLedger as never,
      pagination,
      where: { patientId },
      include: {
        payment: {
          select: {
            method: true,
            provider: { select: { name: true } },
          },
        },
      },
    })) as { items: RawRow[]; total: number };

    return {
      total: result.total,
      items: result.items.map((row) => ({
        id: row.id,
        amount: row.amount.toFixed(2),
        currency: row.currency,
        category: row.category,
        entryDate: row.entryDate,
        status: row.status,
        description: row.description,
        paymentMethod: row.payment?.method ?? null,
        providerName: row.payment?.provider?.name ?? null,
      })),
    };
  }

  /**
   * Hasta bakiyesi **para birimi başına** üretilir. Sağlık turizmi hastası aynı
   * dosyada TRY ve EUR ödüyor; tek bir toplam 1.000 EUR ile 1.000 TRY'yi
   * toplayıp bakiyeyi uyduruyordu. Kur çevrimi burada YAPILMAZ (fonksiyonel
   * para çevrimi yalnız fişleme anında, bkz. doc 07).
   */
  async getPatientSummary(patientId: string): Promise<PatientFinanceSummary> {
    const [ledgerRows, paymentRows] = await Promise.all([
      this.db.financeLedger.groupBy({
        by: ['type', 'currency'],
        where: { patientId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.db.payment.groupBy({
        by: ['currency'],
        where: {
          patientId,
          status: { notIn: SERVICE_AMOUNT_EXCLUDED_PAYMENT_STATUSES },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const byCurrency = new Map<
      Currency,
      { payments: Prisma.Decimal; service: Prisma.Decimal }
    >();

    const bucket = (currency: Currency) => {
      const existing = byCurrency.get(currency);
      if (existing) return existing;
      const created = { payments: ZERO, service: ZERO };
      byCurrency.set(currency, created);
      return created;
    };

    for (const row of ledgerRows) {
      if (row.type !== LedgerType.INCOME) continue;
      const target = bucket(row.currency);
      target.payments = target.payments.add(row._sum.amount ?? ZERO);
    }

    for (const row of paymentRows) {
      const target = bucket(row.currency);
      target.service = target.service.add(row._sum.totalAmount ?? ZERO);
    }

    const balances: PatientCurrencyBalance[] = [...byCurrency.entries()].map(
      ([currency, totals]) => ({
        currency,
        totalServiceAmount: totals.service.toFixed(2),
        totalPayments: totals.payments.toFixed(2),
        balance: totals.payments.sub(totals.service).toFixed(2),
      })
    );

    return { balances };
  }

  /**
   * Klinik özeti **para birimi başına**. `totalExpenses` bugün daima 0: gider
   * tarafı (alış faturası, bordro, kasa gideri) bu deftere değil muhasebe
   * defterine yazılıyor — bkz. denetim notu §26 P1-5. Alan kaldırılmadı çünkü
   * defter tipi EXPENSE'i taşıyor; kaynak eklendiğinde sorgu değişmez.
   */
  async getClinicSummary(
    clinicId: string,
    filter: GetSummaryFilter
  ): Promise<LedgerSummary> {
    // Aralık gün sınırlarına genişletilir: `entryDate` tam bir zaman damgasıdır,
    // istek ise bir gün taşır (`?dateTo=2026-01-31` → 00:00:00). Ham `lte` ile
    // ayın **son günü** özetten tamamen düşüyordu — ekrandaki ciro kartı eksik
    // rakam gösteriyor ve hata hiçbir kontrole yakalanmıyordu.
    const { dateFrom, dateTo } = normalizeReportDateRange(filter);

    const dateFilter =
      dateFrom || dateTo
        ? {
            entryDate: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {};

    const rows = await this.db.financeLedger.groupBy({
      by: ['type', 'currency'],
      where: { clinicId, status: 'COMPLETED', ...dateFilter },
      _sum: { amount: true },
      _count: { id: true },
    });

    const byCurrency = new Map<
      Currency,
      { income: Prisma.Decimal; expenses: Prisma.Decimal; count: number }
    >();

    for (const row of rows) {
      const sum = row._sum.amount ?? ZERO;
      const target = byCurrency.get(row.currency) ?? {
        income: ZERO,
        expenses: ZERO,
        count: 0,
      };

      if (row.type === LedgerType.INCOME) {
        target.income = target.income.add(sum);
      } else {
        target.expenses = target.expenses.add(sum);
      }
      target.count += row._count.id;

      byCurrency.set(row.currency, target);
    }

    const totals: LedgerCurrencyTotal[] = [...byCurrency.entries()].map(
      ([currency, t]) => ({
        currency,
        totalIncome: t.income.toFixed(2),
        totalExpenses: t.expenses.toFixed(2),
        balance: t.income.sub(t.expenses).toFixed(2),
        entryCount: t.count,
      })
    );

    return {
      totals,
      entryCount: totals.reduce((acc, t) => acc + t.entryCount, 0),
    };
  }

  async sumIncomeByPatientIds(
    filter: SumIncomeByPatientsFilter
  ): Promise<PatientRevenue[]> {
    if (filter.patientIds.length === 0) return [];

    const rows = await this.db.financeLedger.groupBy({
      by: ['patientId', 'currency'],
      where: {
        patientId: { in: filter.patientIds },
        type: LedgerType.INCOME,
        status: 'COMPLETED',
        entryDate: { gte: filter.from, lte: filter.to },
      },
      _sum: { amount: true },
    });

    return rows
      .filter((r) => r.patientId !== null)
      .map((r) => ({
        patientId: r.patientId as string,
        currency: r.currency,
        revenue: (r._sum.amount ?? ZERO).toFixed(2),
      }));
  }

  async findEntryStatusesByInstallmentIds(
    installmentIds: string[]
  ): Promise<LedgerEntryStatusRow[]> {
    if (installmentIds.length === 0) return [];

    const rows = await this.db.financeLedger.findMany({
      where: { installmentId: { in: installmentIds } },
      select: { installmentId: true, status: true },
    });

    return rows
      .filter((row) => row.installmentId !== null)
      .map((row) => ({
        installmentId: row.installmentId as string,
        status: row.status,
      }));
  }
}
