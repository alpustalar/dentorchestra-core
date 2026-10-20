import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { CurrencySchema } from '@shared';
import { GetInventoryValuationQuery } from './get-inventory-valuation.query';
import { GetInventoryValuationResponse } from './get-inventory-valuation.response';
import {
  IProductQueryRepository,
  PRODUCT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  InventoryValuationCurrencyTotal,
  InventoryValuationLine,
} from '@modules/supply/inventory/domain/contracts';

/** Defterin fonksiyonel para birimi (Model A). */
const FUNCTIONAL_CURRENCY = CurrencySchema.enum.TRY;

@QueryHandler(GetInventoryValuationQuery)
export class GetInventoryValuationHandler
  implements
    IQueryHandler<GetInventoryValuationQuery, GetInventoryValuationResponse>
{
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productQueryRepo: IProductQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetInventoryValuationQuery
  ): Promise<GetInventoryValuationResponse> {
    const { clinicId, ctx } = query;

    // Stok **değeri** finansal bir büyüklüktür: kapı mizanla aynı modelden
    // geçer (`finance`), depo miktar listesiyle aynı yerden değil. Aksi halde
    // mutabakatın iki yarısı iki farklı yetkiye bakardı ve muhasebeci defteri
    // görüp envanteri göremezdi (ya da tersi).
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin stok değerlemesine erişim yetkiniz yok.'
      )
      .orThrow('inventory.valuation');

    const lines = await this.productQueryRepo.getInventoryValuation(clinicId);

    return {
      data: {
        clinicId,
        asOf: DateTimeManager.create(),
        lines,
        totals: this.sumByCurrency(lines),
        functionalTotal: this.sumCurrency(lines, FUNCTIONAL_CURRENCY),
        hasForeignCurrencyStock: lines.some(
          (line) => line.currency !== FUNCTIONAL_CURRENCY
        ),
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }

  private sumByCurrency(
    lines: InventoryValuationLine[]
  ): InventoryValuationCurrencyTotal[] {
    const byCurrency = new Map<string, Decimal>();

    for (const line of lines) {
      const current = byCurrency.get(line.currency) ?? new Decimal(0);
      byCurrency.set(line.currency, current.plus(line.value));
    }

    return [...byCurrency.entries()]
      .map(([currency, value]) => ({ currency, value: value.toFixed(2) }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private sumCurrency(
    lines: InventoryValuationLine[],
    currency: string
  ): string {
    return lines
      .filter((line) => line.currency === currency)
      .reduce((sum, line) => sum.plus(line.value), new Decimal(0))
      .toFixed(2);
  }
}
