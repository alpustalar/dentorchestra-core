import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBankStatementByIdQuery } from './get-bank-statement-by-id.query';
import { GetBankStatementByIdResponse } from './get-bank-statement-by-id.response';
import {
  BANK_STATEMENT_QUERY_REPOSITORY,
  IBankStatementQueryRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetBankStatementByIdQuery)
export class GetBankStatementByIdHandler implements IQueryHandler<
  GetBankStatementByIdQuery,
  GetBankStatementByIdResponse
> {
  constructor(
    @Inject(BANK_STATEMENT_QUERY_REPOSITORY)
    private readonly bankStatementRepo: IBankStatementQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetBankStatementByIdQuery
  ): Promise<GetBankStatementByIdResponse> {
    const { statementId, ctx } = query;
    const data = await this.bankStatementRepo.findByIdWithLines(statementId);

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    if (!data) {
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
      .check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow('bank-statement.detail');

    return {
      data,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: data.clinicId,
        }),
      },
    };
  }
}
