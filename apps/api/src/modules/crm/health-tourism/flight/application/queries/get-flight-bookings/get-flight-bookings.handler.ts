import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import { ITenantScopeResolver } from '@shared';
import { GetFlightBookingsQuery } from './get-flight-bookings.query';
import { GetFlightBookingsResponse } from './get-flight-bookings.response';
import {
  DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY,
  IDuffelFlightBookingQueryRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@QueryHandler(GetFlightBookingsQuery)
export class GetFlightBookingsHandler implements IQueryHandler<
  GetFlightBookingsQuery,
  GetFlightBookingsResponse
> {
  constructor(
    @Inject(DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(
    query: GetFlightBookingsQuery
  ): Promise<GetFlightBookingsResponse> {
    const { filter, ctx } = query;
    const { actor, source } = ctx;

    const organizationId = await this.tenantScopeResolver.resolve(filter);

    const { items, total } = await this.flightBookingRepo.findMany(
      {
        organizationId,
        clinicId: filter.clinicId,
        patientId: filter.patientId,
        leadId: filter.leadId,
      },
      filter.pagination
    );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(filter.pagination, total),
        serializationOptions: this.policyFactory
          .clinic(actor, source)
          .policy.getSerializationOptions({ clinicId: filter.clinicId }),
      },
    };
  }
}
