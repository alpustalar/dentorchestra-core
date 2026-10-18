import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { FindProductsResponse } from './find-products.response';
import { PaginationDto } from '@shared';

export class FindProductsQuery implements IQuery {
  readonly __responseType!: FindProductsResponse;
  constructor(
    public readonly payload: {
      readonly pagination: PaginationDto;
      readonly clinicId: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
