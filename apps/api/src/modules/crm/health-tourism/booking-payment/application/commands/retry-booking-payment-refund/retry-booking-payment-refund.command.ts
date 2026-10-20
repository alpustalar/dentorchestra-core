import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { RetryBookingPaymentRefundResponse } from './retry-booking-payment-refund.response';

export class RetryBookingPaymentRefundCommand implements ICommand {
  readonly __responseType!: RetryBookingPaymentRefundResponse;

  constructor(
    public readonly refundId: string,
    public readonly ctx: IGetContext
  ) {}
}
