import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { InstallmentStatus, Prisma } from '@prisma/client';
import { Payment } from '@shared';
import {
  ArAgingData,
  ArAgingFilter,
  CollectedInstallmentRow,
  CollectedPaymentRow,
  FindCollectedPaymentsFilter,
  FindSettledInstallmentsFilter,
  InstallmentLedgerRow,
  ProviderRevenueFilterData,
  SettledInstallmentRow,
} from '@modules/finance/payment/domain/contracts/payment';
import {
  IPaymentQueryRepository,
  PaymentWithInstallments,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';
import { normalizeReportDateRange } from '@modules/finance/shared/domain/reporting/report-date-range';

/**
 * "Sonuçlanmış" taksit durumları: parası hareket etmiş, cari defterde karşılığı
 * olmak zorunda olanlar. Tek sabit — mutabakat taraması ile cari kaydın beklenen
 * durumu aynı kümeden türer.
 */
const SETTLED_STATUSES = [
  InstallmentStatus.COMPLETED,
  InstallmentStatus.REFUNDED,
  // Ters ibraz edilmiş taksidin parası da hareket etti (alındı, sonra sağlayıcı
  // geri aldı); cari defterde `CHARGED_BACK` karşılığı olmak zorunda.
  InstallmentStatus.CHARGED_BACK,
];

/** Henüz tahsil edilmemiş (açık) taksit durumları. */
const OUTSTANDING_STATUSES = [
  InstallmentStatus.PENDING,
  InstallmentStatus.OVERDUE,
];

@Injectable()
export class PaymentQueryRepository
  extends BaseRepository
  implements IPaymentQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findByAppointmentId(appointmentId: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { appointmentId } });
  }

  findPaymentWithInstallments(
    paymentId: string
  ): Promise<PaymentWithInstallments | null> {
    return this.db.payment.findUnique({
      where: { id: paymentId },
      include: { installments: { orderBy: { installmentNo: 'asc' } } },
    });
  }

  async findInstallmentForLedger(
    installmentId: string
  ): Promise<InstallmentLedgerRow | null> {
    const row = await this.db.paymentInstallment.findUnique({
      where: { id: installmentId },
      select: {
        id: true,
        paymentId: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        payment: { select: { clinicId: true, patientId: true } },
      },
    });

    if (!row) return null;

    return {
      installmentId: row.id,
      paymentId: row.paymentId,
      clinicId: row.payment.clinicId,
      patientId: row.payment.patientId,
      amount: row.amount as unknown as InstallmentLedgerRow['amount'],
      currency: row.currency,
      status: row.status,
      paidAt: row.paidAt,
    };
  }

  /**
   * `paginate` kullanılmaz: sayfalı liste değil, mutabakat taramasının girdisi
   * — çağıran (finance-ledger) kendi kayıtlarıyla eşleştirip farkı döner.
   * Aralık çağıran tarafından daraltılır (şema `from <= to` zorunlu tutar).
   */
  async findSettledInstallments(
    filter: FindSettledInstallmentsFilter
  ): Promise<SettledInstallmentRow[]> {
    // Pencere gün sınırlarına genişletilir. Rapor da telafi komutu da aynı
    // filtreyi buraya geçiyor: ham `lte` ile son günün taksitleri hem eksik
    // listesinde görünmez hem backfill tarafından onarılmaz — eksik kayıt
    // kalıcı hâle gelir.
    const { dateFrom, dateTo } = normalizeReportDateRange({
      dateFrom: filter.from,
      dateTo: filter.to,
    });

    const rows = await this.db.paymentInstallment.findMany({
      where: {
        status: { in: SETTLED_STATUSES },
        paidAt: { gte: dateFrom, lte: dateTo },
        payment: { clinicId: filter.clinicId },
      },
      select: {
        id: true,
        paymentId: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        payment: { select: { clinicId: true, patientId: true } },
      },
      orderBy: { paidAt: 'asc' },
    });

    return rows.map((row) => ({
      installmentId: row.id,
      paymentId: row.paymentId,
      clinicId: row.payment.clinicId,
      patientId: row.payment.patientId,
      amount: row.amount as unknown as SettledInstallmentRow['amount'],
      currency: row.currency,
      status: row.status,
      settledAt: row.paidAt as Date,
    }));
  }

  /**
   * Aralıkta tahsilatı olan ödemeler (ilk tahsil edilen taksitin `paidAt`'i
   * aralıkta olanlar). `paginate` kullanılmaz: bu bir sayfalı liste değil,
   * mutabakat taramasının girdisi — çağıran (invoice) kendi kayıtlarıyla
   * eşleştirip eksikleri döndürür. Aralık çağıran tarafından daraltılır.
   */
  async findCollectedPayments(
    filter: FindCollectedPaymentsFilter
  ): Promise<CollectedPaymentRow[]> {
    const { dateFrom, dateTo } = normalizeReportDateRange({
      dateFrom: filter.from,
      dateTo: filter.to,
    });

    const rows = await this.db.payment.findMany({
      where: {
        clinicId: filter.clinicId,
        installments: {
          some: {
            status: InstallmentStatus.COMPLETED,
            paidAt: { gte: dateFrom, lte: dateTo },
          },
        },
      },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        appointmentId: true,
        totalAmount: true,
        currency: true,
        installments: {
          where: {
            status: InstallmentStatus.COMPLETED,
            paidAt: { gte: dateFrom, lte: dateTo },
          },
          orderBy: { paidAt: 'asc' },
          take: 1,
          select: { paidAt: true },
        },
      },
    });

    return rows.map((row) => ({
      paymentId: row.id,
      clinicId: row.clinicId,
      patientId: row.patientId,
      appointmentId: row.appointmentId,
      totalAmount:
        row.totalAmount as unknown as CollectedPaymentRow['totalAmount'],
      currency: row.currency,
      firstCollectedAt: row.installments[0]?.paidAt as Date,
    }));
  }

  /**
   * Yaşlandırma girdisi. Tahsilat toplamı **para birimi başına** gruplanır:
   * tek bir `_sum` farklı para birimlerini toplayıp anlamsız bir sayı üretir.
   */
  async arAging(filter: ArAgingFilter): Promise<ArAgingData> {
    const [openRows, collected] = await Promise.all([
      this.db.paymentInstallment.findMany({
        where: {
          status: { in: OUTSTANDING_STATUSES },
          payment: { clinicId: filter.clinicId },
        },
        select: {
          amount: true,
          currency: true,
          dueDate: true,
          payment: { select: { patientId: true } },
        },
      }),
      this.db.paymentInstallment.groupBy({
        by: ['currency'],
        where: {
          status: InstallmentStatus.COMPLETED,
          payment: { clinicId: filter.clinicId },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      openInstallments: openRows.map((row) => ({
        patientId: row.payment.patientId,
        amount: row.amount,
        currency: row.currency,
        dueDate: row.dueDate,
      })),
      collectedTotals: collected.map((group) => ({
        currency: group.currency,
        amount: group._sum.amount ?? new Prisma.Decimal(0),
      })),
    };
  }

  async providerRevenue(
    filter: ProviderRevenueFilterData
  ): Promise<CollectedInstallmentRow[]> {
    const where: Prisma.PaymentInstallmentWhereInput = {
      status: InstallmentStatus.COMPLETED,
      payment: { clinicId: filter.clinicId },
    };

    // `paidAt` tam bir zaman damgası, istek ise bir gün taşıyor. Ham `lte` ile
    // dönemin son günü tahsil edilen taksitler hasılata girmiyordu — hekim
    // hasılatı prim/komisyon hesabını beslediği için eksiklik para etkisi taşır.
    const { dateFrom, dateTo } = normalizeReportDateRange(filter);
    if (dateFrom || dateTo) {
      where.paidAt = { gte: dateFrom, lte: dateTo };
    }

    const rows = await this.db.paymentInstallment.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        payment: { select: { providerId: true } },
      },
    });

    return rows.map((row) => ({
      providerId: row.payment.providerId,
      amount: row.amount,
      currency: row.currency,
    }));
  }
}
