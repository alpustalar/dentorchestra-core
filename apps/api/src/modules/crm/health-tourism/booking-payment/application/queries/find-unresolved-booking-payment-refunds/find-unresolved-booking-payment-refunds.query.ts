import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { Pagination } from '@shared/common';
import type { GetUnresolvedBookingPaymentRefunds } from '@shared/modules/health-tourism/types/queries';
import { FindUnresolvedBookingPaymentRefundsResponse } from './find-unresolved-booking-payment-refunds.response';

export class FindUnresolvedBookingPaymentRefundsQuery implements IQuery {
  readonly __responseType!: FindUnresolvedBookingPaymentRefundsResponse;

  constructor(
    public readonly payload: {
      readonly filter: GetUnresolvedBookingPaymentRefunds;
      readonly pagination: Pagination;
      readonly ctx: IGetContext;
    }
  ) {}
}
