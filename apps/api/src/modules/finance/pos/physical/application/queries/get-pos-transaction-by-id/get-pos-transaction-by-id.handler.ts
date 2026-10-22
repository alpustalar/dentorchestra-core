import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetPosTransactionByIdQuery } from './get-pos-transaction-by-id.query';
import { GetPosTransactionByIdResponse } from './get-pos-transaction-by-id.response';
import {
  IPosTransactionQueryRepository,
  POS_TRANSACTION_QUERY_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetPosTransactionByIdQuery)
export class GetPosTransactionByIdHandler implements IQueryHandler<
  GetPosTransactionByIdQuery,
  GetPosTransactionByIdResponse
> {
  constructor(
    @Inject(POS_TRANSACTION_QUERY_REPOSITORY)
    private readonly posTransactionQueryRepo: IPosTransactionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetPosTransactionByIdQuery
  ): Promise<GetPosTransactionByIdResponse> {
    const { posTransactionId, ctx } = query;

    const summary =
      await this.posTransactionQueryRepo.findSummaryById(posTransactionId);

    if (!summary) return { data: null };

    // Sorgu bus üzerinden her modülden çağrılabiliyor: kapsam kontrolü burada da
    // yapılır ki tek bir çağıranın unutması başka bir kliniğin hasta/plan
    // kimliklerini sızdırmasın (RecordFinancialEvent ile aynı gerekçe).
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(summary.clinicId))
      .orThrow('pos.transaction.get');

    return {
      data: summary,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: summary.clinicId,
        }),
      },
    };
  }
}
