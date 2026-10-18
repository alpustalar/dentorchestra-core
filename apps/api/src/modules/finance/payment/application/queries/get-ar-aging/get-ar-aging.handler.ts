import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DateTimeManager } from '@common/utils';
import { GetArAgingQuery } from './get-ar-aging.query';
import {
  ArAgingBucket,
  ArAgingBucketLabel,
  ArAgingPatientRisk,
  ArAgingSummary,
  GetArAgingResponse,
} from './get-ar-aging.response';
import { Decimal } from 'decimal.js';
import {
  CollectedTotalRow,
  OpenInstallmentRow,
} from '@modules/finance/payment/domain/contracts/payment';
import {
  IPaymentQueryRepository,
  PAYMENT_QUERY_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';

const BUCKET_ORDER: ArAgingBucketLabel[] = [
  'NOT_DUE',
  'D0_30',
  'D31_60',
  'D61_90',
  'D90_PLUS',
];

interface PatientAccumulator {
  outstanding: Decimal;
  overdue: Decimal;
  oldestDueDate: Date | null;
}

interface CurrencyAccumulator {
  outstanding: Decimal;
  overdue: Decimal;
}

/**
 * Alacak yaşlandırma raporu.
 *
 * Tüm toplamlar **para birimi başına** üretilir; birimler arası toplam
 * alınmaz. Taksit satırları kur bilgisi taşımadığı için TRY'ye çevirmek
 * (Model A) burada mümkün değil — farklı birimleri toplamak ise yönetime
 * yanlış bir alacak büyüklüğü gösterir.
 */
@QueryHandler(GetArAgingQuery)
export class GetArAgingHandler implements IQueryHandler<
  GetArAgingQuery,
  GetArAgingResponse
> {
  constructor(
    @Inject(PAYMENT_QUERY_REPOSITORY)
    private readonly paymentRepo: IPaymentQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetArAgingQuery): Promise<GetArAgingResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin alacak yaşlandırma raporuna erişim yetkiniz yok.'
      )
      .orThrow('payment.ar-aging');
    // Saat farkından kaynaklanan yanlış vadelendirmeyi önlemek için gün başına normalize et.
    const asOf = DateTimeManager.startOfDay(
      query.asOf ?? DateTimeManager.create()
    );

    const { openInstallments, collectedTotals } =
      await this.paymentRepo.arAging({ clinicId });

    return {
      data: {
        clinicId,
        asOf,
        buckets: this.buildBuckets(openInstallments, asOf),
        patients: this.buildPatientRisk(openInstallments, asOf),
        summaries: this.buildSummaries(openInstallments, collectedTotals, asOf),
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }

  private buildBuckets(
    rows: OpenInstallmentRow[],
    asOf: Date
  ): ArAgingBucket[] {
    const acc = new Map<string, { count: number; amount: Decimal }>();

    for (const row of rows) {
      const key = `${this.classify(row, asOf)}|${row.currency}`;
      const bucket = acc.get(key) ?? { count: 0, amount: new Decimal(0) };
      bucket.count += 1;
      bucket.amount = bucket.amount.plus(this.toDecimal(row.amount));
      acc.set(key, bucket);
    }

    // Kovalar her para birimi için sabit sırada (boş kova da görünür) üretilir.
    return [...this.currenciesOf(rows)].flatMap((currency) =>
      BUCKET_ORDER.map((label) => {
        const bucket = acc.get(`${label}|${currency}`);
        return {
          label,
          currency,
          count: bucket?.count ?? 0,
          amount: (bucket?.amount ?? new Decimal(0)).toFixed(2),
        };
      })
    );
  }

  private buildPatientRisk(
    rows: OpenInstallmentRow[],
    asOf: Date
  ): ArAgingPatientRisk[] {
    const acc = new Map<string, PatientAccumulator>();

    for (const row of rows) {
      const key = `${row.patientId}|${row.currency}`;
      const entry = acc.get(key) ?? {
        outstanding: new Decimal(0),
        overdue: new Decimal(0),
        oldestDueDate: null,
      };
      const amount = this.toDecimal(row.amount);
      entry.outstanding = entry.outstanding.plus(amount);
      if (this.isOverdue(row, asOf)) {
        entry.overdue = entry.overdue.plus(amount);
      }
      if (
        row.dueDate &&
        (!entry.oldestDueDate || row.dueDate < entry.oldestDueDate)
      ) {
        entry.oldestDueDate = row.dueDate;
      }
      acc.set(key, entry);
    }

    // Sıralama string'e dönmeden önce ham Decimal'lar üzerinde yapılır.
    return [...acc.entries()]
      .sort(([, aEntry], [, bEntry]) =>
        bEntry.overdue.comparedTo(aEntry.overdue)
      )
      .map(([key, entry]) => {
        const [patientId, currency] = key.split('|');
        return {
          patientId,
          currency: currency as CurrencyType,
          outstanding: entry.outstanding.toFixed(2),
          overdue: entry.overdue.toFixed(2),
          oldestDueDate: entry.oldestDueDate,
        };
      });
  }

  private buildSummaries(
    rows: OpenInstallmentRow[],
    collectedTotals: CollectedTotalRow[],
    asOf: Date
  ): ArAgingSummary[] {
    const open = new Map<CurrencyType, CurrencyAccumulator>();

    for (const row of rows) {
      const entry = open.get(row.currency) ?? {
        outstanding: new Decimal(0),
        overdue: new Decimal(0),
      };
      const amount = this.toDecimal(row.amount);
      entry.outstanding = entry.outstanding.plus(amount);
      if (this.isOverdue(row, asOf)) {
        entry.overdue = entry.overdue.plus(amount);
      }
      open.set(row.currency, entry);
    }

    const collected = new Map<CurrencyType, Decimal>(
      collectedTotals.map((row) => [row.currency, this.toDecimal(row.amount)])
    );

    const currencies = new Set<CurrencyType>([
      ...open.keys(),
      ...collected.keys(),
    ]);

    return [...currencies].map((currency) => {
      const outstanding = open.get(currency)?.outstanding ?? new Decimal(0);
      const overdue = open.get(currency)?.overdue ?? new Decimal(0);
      const collectedTotal = collected.get(currency) ?? new Decimal(0);
      const denominator = collectedTotal.plus(outstanding);

      return {
        currency,
        totalOutstanding: outstanding.toFixed(2),
        totalOverdue: overdue.toFixed(2),
        totalCollected: collectedTotal.toFixed(2),
        collectionRate: denominator.isZero()
          ? new Decimal(0).toFixed(4)
          : collectedTotal.div(denominator).toFixed(4),
      };
    });
  }

  private currenciesOf(rows: OpenInstallmentRow[]): Set<CurrencyType> {
    return new Set(rows.map((row) => row.currency));
  }

  /** Prisma Decimal ↔ decimal.js: aritmetik tek kütüphanede yapılır. */
  private toDecimal(amount: OpenInstallmentRow['amount']): Decimal {
    return new Decimal(amount.toString());
  }

  private classify(row: OpenInstallmentRow, asOf: Date): ArAgingBucketLabel {
    if (!this.isOverdue(row, asOf)) return 'NOT_DUE';
    const days = DateTimeManager.diffInDays(asOf, row.dueDate as Date);
    if (days <= 30) return 'D0_30';
    if (days <= 60) return 'D31_60';
    if (days <= 90) return 'D61_90';
    return 'D90_PLUS';
  }

  // dueDate'i de gün başına normalize ederek saat farkı kaynaklı hatalı vadelendirmeyi engeller.
  private isOverdue(row: OpenInstallmentRow, asOf: Date): boolean {
    return (
      row.dueDate != null && DateTimeManager.startOfDay(row.dueDate) < asOf
    );
  }
}
