import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetProviderRevenueQuery } from './get-provider-revenue.query';
import {
  GetProviderRevenueResponse,
  ProviderRevenueLine,
  ProviderRevenueTotal,
} from './get-provider-revenue.response';
import { Decimal } from 'decimal.js';
import {
  IPaymentQueryRepository,
  PAYMENT_QUERY_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';

/** providerId null grubu için sabit anahtar (Map key olarak kullanılır). */
const UNASSIGNED = '__unassigned__';

/**
 * Hekim bazında tahsilat. Satır anahtarı **hekim + para birimi**: farklı
 * birimlerdeki tahsilatları tek satırda toplamak (1.000 EUR + 1.000 TRY = 2.000)
 * yönetime yanlış bir ciro gösteriyordu.
 */
@QueryHandler(GetProviderRevenueQuery)
export class GetProviderRevenueHandler implements IQueryHandler<
  GetProviderRevenueQuery,
  GetProviderRevenueResponse
> {
  constructor(
    @Inject(PAYMENT_QUERY_REPOSITORY)
    private readonly paymentQueryRepo: IPaymentQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetProviderRevenueQuery
  ): Promise<GetProviderRevenueResponse> {
    const { clinicId, dateFrom, dateTo, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin hekim ciro raporuna erişim yetkiniz yok.'
      )
      .orThrow('payment.provider-revenue');

    const rows = await this.paymentQueryRepo.providerRevenue({
      clinicId,
      dateFrom,
      dateTo,
    });

    const acc = new Map<string, { collected: Decimal; count: number }>();
    const totals = new Map<CurrencyType, Decimal>();

    for (const row of rows) {
      const amount = new Decimal(row.amount.toString());
      const key = `${row.providerId ?? UNASSIGNED}|${row.currency}`;
      const entry = acc.get(key) ?? { collected: new Decimal(0), count: 0 };
      entry.collected = entry.collected.plus(amount);
      entry.count += 1;
      acc.set(key, entry);

      totals.set(
        row.currency,
        (totals.get(row.currency) ?? new Decimal(0)).plus(amount)
      );
    }

    // Sıralama string'e dönmeden önce ham Decimal'lar üzerinde yapılır.
    // UNASSIGNED grubu ciro büyüklüğünden bağımsız olarak her zaman en alta sabitlenir.
    const lines: ProviderRevenueLine[] = [...acc.entries()]
      .sort(([aKey, aEntry], [bKey, bEntry]) => {
        const aUnassigned = aKey.startsWith(`${UNASSIGNED}|`);
        const bUnassigned = bKey.startsWith(`${UNASSIGNED}|`);
        if (aUnassigned && !bUnassigned) return 1;
        if (bUnassigned && !aUnassigned) return -1;
        return bEntry.collected.comparedTo(aEntry.collected);
      })
      .map(([key, entry]) => {
        const separator = key.lastIndexOf('|');
        const providerKey = key.slice(0, separator);
        return {
          providerId: providerKey === UNASSIGNED ? null : providerKey,
          currency: key.slice(separator + 1) as CurrencyType,
          collected: entry.collected.toFixed(2),
          count: entry.count,
        };
      });

    const totalLines: ProviderRevenueTotal[] = [...totals.entries()].map(
      ([currency, collected]) => ({ currency, collected: collected.toFixed(2) })
    );

    return {
      data: {
        clinicId,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        lines,
        totals: totalLines,
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
