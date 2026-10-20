import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { ResolveBookingPaymentRefund } from '@shared/modules/health-tourism/types/commands';
import { ResolveBookingPaymentRefundResponse } from './resolve-booking-payment-refund.response';

/**
 * Sonucu doğrulanamamış bir rezervasyon iadesinin operatör tarafından elle kapatılması.
 * Payload'da 2'den fazla alan olduğu için tek `payload` objesi.
 */
export class ResolveBookingPaymentRefundCommand implements ICommand {
  readonly __responseType!: ResolveBookingPaymentRefundResponse;

  constructor(
    public readonly payload: {
      readonly refundId: string;
      readonly data: ResolveBookingPaymentRefund;
      readonly ctx: IGetContext;
    }
  ) {}
}
