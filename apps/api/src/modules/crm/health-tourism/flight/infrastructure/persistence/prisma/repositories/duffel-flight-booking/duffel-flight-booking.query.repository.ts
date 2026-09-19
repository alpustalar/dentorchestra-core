import { Injectable } from '@nestjs/common';
import { DuffelFlightBooking, Pagination } from '@shared';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { FindFlightBookingsFilter } from '@modules/crm/health-tourism/flight/domain/contracts';
import { IDuffelFlightBookingQueryRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.query.repository';

@Injectable()
export class DuffelFlightBookingQueryRepository
  extends BaseRepository
  implements IDuffelFlightBookingQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<DuffelFlightBooking | null> {
    return this.db.duffelFlightBooking.findUnique({ where: { id } });
  }

  findByDuffelOrderId(
    duffelOrderId: string
  ): Promise<DuffelFlightBooking | null> {
    return this.db.duffelFlightBooking.findUnique({ where: { duffelOrderId } });
  }

  async findMany(
    filter: FindFlightBookingsFilter,
    pagination: Pagination
  ): Promise<{ items: DuffelFlightBooking[]; total: number }> {
    const where = {
      organizationId: filter.organizationId,
      ...(filter.clinicId ? { clinicId: filter.clinicId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
      ...(filter.leadId ? { leadId: filter.leadId } : {}),
    };

    const result = await paginate({
      delegate: this.db.duffelFlightBooking,
      pagination,
      where,
    });

    return { items: result.items, total: result.total };
  }
}
