import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetRevenueByPatientsQuery } from './get-revenue-by-patients.query';
import { GetRevenueByPatientsResponse } from './get-revenue-by-patients.response';
import {
  FINANCE_LEDGER_QUERY_REPOSITORY,
  IFinanceLedgerQueryRepository,
} from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.query.repository';

@QueryHandler(GetRevenueByPatientsQuery)
export class GetRevenueByPatientsHandler implements IQueryHandler<
  GetRevenueByPatientsQuery,
  GetRevenueByPatientsResponse
> {
  constructor(
    @Inject(FINANCE_LEDGER_QUERY_REPOSITORY)
    private readonly financeLedgerRepo: IFinanceLedgerQueryRepository
  ) {}

  async execute(
    query: GetRevenueByPatientsQuery
  ): Promise<GetRevenueByPatientsResponse> {
    const data = await this.financeLedgerRepo.sumIncomeByPatientIds({
      patientIds: query.patientIds,
      from: query.from,
      to: query.to,
    });
    return { data };
  }
}
