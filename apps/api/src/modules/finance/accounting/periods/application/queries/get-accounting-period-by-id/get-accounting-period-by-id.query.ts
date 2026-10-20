import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetAccountingPeriodByIdResponse } from './get-accounting-period-by-id.response';

/**
 * Kimliğiyle bir muhasebe dönemi. Yıl sonu kapanış önizlemesi (posting modülü) dönemi kimliğinden
 * çözer; dönem tablosuna doğrudan erişmez (modüller arası veri yalnız bus üzerinden).
 */
export class GetAccountingPeriodByIdQuery implements IQuery {
  readonly __responseType!: GetAccountingPeriodByIdResponse;
  constructor(
    public readonly periodId: string,
    public readonly ctx: IGetContext
  ) {}
}
