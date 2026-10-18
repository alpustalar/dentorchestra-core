import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindCollectedPaymentsResponse } from './find-collected-payments.response';

/**
 * Aralıkta tahsilatı olan ödemeler. Fatura eksiği taramasının (invoice modülü)
 * kaynak listesidir: faturanın var olup olmadığını bu modül bilmez, yalnız
 * adayları döner.
 */
export class FindCollectedPaymentsQuery implements IQuery {
  readonly __responseType!: FindCollectedPaymentsResponse;
  constructor(
    public readonly payload: {
      readonly filter: {
        readonly clinicId: string;
        readonly from: Date;
        readonly to: Date;
      };
      readonly ctx: IGetContext;
    }
  ) {}
}
