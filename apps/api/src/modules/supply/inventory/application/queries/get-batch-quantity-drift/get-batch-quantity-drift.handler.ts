import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { GetBatchQuantityDriftQuery } from './get-batch-quantity-drift.query';
import { GetBatchQuantityDriftResponse } from './get-batch-quantity-drift.response';
import {
  IStockMovementQueryRepository,
  STOCK_MOVEMENT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/stock-movement/stock-movement.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BatchQuantityDriftCurrencyTotal,
  BatchQuantityDriftLine,
} from '@modules/supply/inventory/domain/contracts/stock-movement/stock-movement-queries.contracts';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

/**
 * Sapmayı gösterir, **onarmaz** (CLAUDE.md finans kuralı 11): miktarı
 * hareketlere eşitlemek eksik hareketi uydurmak, hareketleri miktara eşitlemek
 * ise fiilî stoğu yalanlamak olurdu — hangisinin doğru olduğu bir sayım kararıdır.
 *
 * Yetki **finans** tarafında: satır sapmanın değerlemeye etkisini (tutar)
 * taşıyor. Miktarı görmek (depo) ile değeri görmek (muhasebe) aynı şey değildir
 * — envanter değerlemesiyle aynı ölçüt.
 */
@QueryHandler(GetBatchQuantityDriftQuery)
export class GetBatchQuantityDriftHandler implements IQueryHandler<
  GetBatchQuantityDriftQuery,
  GetBatchQuantityDriftResponse
> {
  constructor(
    @Inject(STOCK_MOVEMENT_QUERY_REPOSITORY)
    private readonly stockMovementQueryRepo: IStockMovementQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetBatchQuantityDriftQuery
  ): Promise<GetBatchQuantityDriftResponse> {
    const { clinicId, ctx } = query;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('inventory.batch-quantity-drift');

    const lines =
      await this.stockMovementQueryRepo.getBatchQuantityDrift(clinicId);

    return {
      data: {
        clinicId,
        asOf: DateTimeManager.create(),
        lines,
        totals: this.sumByCurrency(lines),
        driftedBatchCount: lines.length,
      },
    };
  }

  /**
   * Para birimi başına **işaretli** toplam: pozitif ve negatif sapmalar burada
   * netleşir çünkü ikisi de aynı şeyin ölçüsüdür — "değerleme ne kadar yanlış".
   * (Mal kabul ↔ fatura sapmasında durum farklıydı: orada iki yön iki ayrı
   * muhasebe kalemi olduğu için netleştirilmiyor.)
   */
  private sumByCurrency(
    lines: BatchQuantityDriftLine[]
  ): BatchQuantityDriftCurrencyTotal[] {
    const byCurrency = new Map<string, { value: Decimal; count: number }>();

    for (const line of lines) {
      const bucket = byCurrency.get(line.currency) ?? {
        value: new Decimal(0),
        count: 0,
      };
      bucket.value = bucket.value.plus(new Decimal(line.valueDrift));
      bucket.count += 1;
      byCurrency.set(line.currency, bucket);
    }

    return [...byCurrency.entries()].map(([currency, bucket]) => ({
      currency,
      valueDrift: bucket.value.toFixed(2),
      batchCount: bucket.count,
    }));
  }
}
