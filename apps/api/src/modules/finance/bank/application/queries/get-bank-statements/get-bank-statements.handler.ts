import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBankStatementsQuery } from './get-bank-statements.query';
import { GetBankStatementsResponse } from './get-bank-statements.response';
import {
  BANK_STATEMENT_QUERY_REPOSITORY,
  IBankStatementQueryRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetBankStatementsQuery)
export class GetBankStatementsHandler implements IQueryHandler<
  GetBankStatementsQuery,
  GetBankStatementsResponse
> {
  constructor(
    @Inject(BANK_STATEMENT_QUERY_REPOSITORY)
    private readonly bankStatementRepo: IBankStatementQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetBankStatementsQuery
  ): Promise<GetBankStatementsResponse> {
    const { filter, pagination, ctx } = query.payload;
    const clinicId = ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('bank-statement.list');

    const result = await this.bankStatementRepo.findByClinic({
      clinicId,
      bankAccountId: filter.bankAccountId,
      pagination,
    });

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
