import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { GetUnbridgedPosTransactions } from '@shared/modules/pos/types/queries';
import { FindUnbridgedPosTransactionsResponse } from './find-unbridged-pos-transactions.response';

export class FindUnbridgedPosTransactionsQuery implements IQuery {
  readonly __responseType!: FindUnbridgedPosTransactionsResponse;

  constructor(
    public readonly payload: {
      readonly filter: GetUnbridgedPosTransactions;
      readonly ctx: IGetContext;
    }
  ) {}
}
