import { DuffelFlightBooking, Pagination } from '@shared';
import { FindFlightBookingsFilter } from '@modules/crm/health-tourism/flight/domain/contracts';

export const DUFFEL_FLIGHT_BOOKING_QUERY_REPOSITORY = Symbol(
  'IDuffelFlightBookingQueryRepository'
);

/**
 * Okuma tarafı düz Prisma kaydı döndürür (entity hidrate etmez) — veri doğrudan
 * HTTP sınırını geçiyor.
 */
export interface IDuffelFlightBookingQueryRepository {
  findById(id: string): Promise<DuffelFlightBooking | null>;
  findByDuffelOrderId(
    duffelOrderId: string
  ): Promise<DuffelFlightBooking | null>;
  findMany(
    filter: FindFlightBookingsFilter,
    pagination: Pagination
  ): Promise<{ items: DuffelFlightBooking[]; total: number }>;
}
