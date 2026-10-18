import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetLowStockAlertsResponse } from './get-low-stock-alerts.response';

export class GetLowStockAlertsQuery implements IQuery {
  readonly __responseType!: GetLowStockAlertsResponse;
  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
