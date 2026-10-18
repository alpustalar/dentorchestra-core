import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { GetStalePosTransactions } from '@shared/modules/pos/types/queries';
import { FindStalePosTransactionsResponse } from './find-stale-pos-transactions.response';

/**
 * Askıda kalmış (PENDING) POS işlemleri — operasyonun "kart çekildi mi?"
 * sorusunu sorabileceği tek liste.
 */
export class FindStalePosTransactionsQuery implements IQuery {
  readonly __responseType!: FindStalePosTransactionsResponse;

  constructor(
    public readonly payload: {
      readonly filter: GetStalePosTransactions;
      readonly ctx: IGetContext;
    }
  ) {}
}
