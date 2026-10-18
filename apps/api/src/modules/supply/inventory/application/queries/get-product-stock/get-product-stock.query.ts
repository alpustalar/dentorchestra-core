import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetProductStockResponse } from './get-product-stock.response';

export class GetProductStockQuery implements IQuery {
  readonly __responseType!: GetProductStockResponse;
  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
