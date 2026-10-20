import { IQuery } from '@nestjs/cqrs';
import { GetCardChargebacks } from '@shared/modules/bank/types/queries';
import { Pagination } from '@shared/common';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetCardChargebacksResponse } from './get-card-chargebacks.response';

export class GetCardChargebacksQuery implements IQuery {
  readonly __responseType!: GetCardChargebacksResponse;
  constructor(
    public readonly payload: {
      readonly filter: GetCardChargebacks;
      readonly pagination: Pagination;
      readonly ctx: IGetContext;
    }
  ) {}
}
