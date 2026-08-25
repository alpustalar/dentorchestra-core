import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetFlightBookingByIdQuery } from './get-flight-booking-by-id.query';
import { GetFlightBookingByIdResponse } from './get-flight-booking-by-id.response';
import { FlightBookingNotFoundException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import {
  DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY,
  IDuffelFlightBookingQueryRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetFlightBookingByIdQuery)
export class GetFlightBookingByIdHandler implements IQueryHandler<
  GetFlightBookingByIdQuery,
  GetFlightBookingByIdResponse
> {
  constructor(
    @Inject(DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetFlightBookingByIdQuery
  ): Promise<GetFlightBookingByIdResponse> {
    const booking = await this.flightBookingRepo.findById(query.bookingId);
    if (!booking) throw new FlightBookingNotFoundException(query.bookingId);

    const { policy } = this.policyFactory.clinic(
      query.ctx.actor,
      query.ctx.source
    );

    return {
      data: booking,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: booking.clinicId,
        }),
      },
    };
  }
}
