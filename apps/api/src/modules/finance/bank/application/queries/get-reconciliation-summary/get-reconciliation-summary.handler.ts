import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetReconciliationSummaryQuery } from './get-reconciliation-summary.query';
import { GetReconciliationSummaryResponse } from './get-reconciliation-summary.response';
import {
  BANK_STATEMENT_QUERY_REPOSITORY,
  IBankStatementQueryRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetReconciliationSummaryQuery)
export class GetReconciliationSummaryHandler implements IQueryHandler<
  GetReconciliationSummaryQuery,
  GetReconciliationSummaryResponse
> {
  constructor(
    @Inject(BANK_STATEMENT_QUERY_REPOSITORY)
    private readonly statementQueryRepo: IBankStatementQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetReconciliationSummaryQuery
  ): Promise<GetReconciliationSummaryResponse> {
    const { statementId, ctx } = query;

    const statement = await this.statementQueryRepo.findById(statementId);

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    if (!statement) {
      return {
        data: null,
        meta: {
          serializationOptions: policy.getSerializationOptions({
            clinicId: ctx.actor.clinicId ?? '',
          }),
        },
      };
    }

    evaluator
      .check((p) => p.canAccessClinicFinances(statement.clinicId))
      .orThrow('bank-reconciliation.summary');

    const data =
      await this.statementQueryRepo.reconciliationSummary(statementId);

    return {
      data,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: statement.clinicId,
        }),
      },
    };
  }
}
