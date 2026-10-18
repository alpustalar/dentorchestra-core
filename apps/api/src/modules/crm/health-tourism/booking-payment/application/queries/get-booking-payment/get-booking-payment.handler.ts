import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBookingPaymentQuery } from './get-booking-payment.query';
import { GetBookingPaymentResponse } from './get-booking-payment.response';
import {
  BOOKING_PAYMENT_QUERY_REPOSITORY,
  IBookingPaymentQueryRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.query.repository';

@QueryHandler(GetBookingPaymentQuery)
export class GetBookingPaymentHandler implements IQueryHandler<
  GetBookingPaymentQuery,
  GetBookingPaymentResponse
> {
  constructor(
    @Inject(BOOKING_PAYMENT_QUERY_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentQueryRepository
  ) {}

  async execute(
    query: GetBookingPaymentQuery
  ): Promise<GetBookingPaymentResponse> {
    const bp = await this.bookingPaymentRepo.findById(query.bookingPaymentId);
    if (!bp) return { data: null };

    return {
      data: {
        id: bp.id,
        bookingType: bp.bookingType,
        status: bp.status,
        bookingReference: bp.bookingReference,
        saleAmount: Number(bp.saleAmount),
        saleCurrency: bp.saleCurrency,
      },
    };
  }
}
