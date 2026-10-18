import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TaxParameterNotConfiguredException } from '@modules/finance/accounting/tax-parameters/domain/exceptions';
import { GetTaxRateQuery } from './get-tax-rate.query';
import { GetTaxRateResponse } from './get-tax-rate.response';
import {
  ITaxParameterQueryRepository,
  TAX_PARAMETER_QUERY_REPOSITORY,
} from '@modules/finance/accounting/tax-parameters/domain/repositories/tax-parameter/tax-parameter.query.repository';

@QueryHandler(GetTaxRateQuery)
export class GetTaxRateHandler implements IQueryHandler<
  GetTaxRateQuery,
  GetTaxRateResponse
> {
  constructor(
    @Inject(TAX_PARAMETER_QUERY_REPOSITORY)
    private readonly taxParameterRepo: ITaxParameterQueryRepository
  ) {}

  async execute(query: GetTaxRateQuery): Promise<GetTaxRateResponse> {
    const { clinicId, key, date } = query;

    const effective = await this.taxParameterRepo.findEffective(
      clinicId,
      key,
      date
    );

    if (!effective) {
      throw new TaxParameterNotConfiguredException(clinicId, key);
    }

    // Oran DB'de Decimal; dışarıya yüzde sayısı olarak verilir.
    return { data: { key, rate: effective.rate.toNumber() } };
  }
}
