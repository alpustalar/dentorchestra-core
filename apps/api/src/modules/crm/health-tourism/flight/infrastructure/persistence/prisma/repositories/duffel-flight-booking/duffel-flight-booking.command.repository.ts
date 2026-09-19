import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';

@Injectable()
export class DuffelFlightBookingCommandRepository
  extends BaseRepository
  implements IDuffelFlightBookingCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<DuffelFlightBooking | null> {
    const raw = await this.db.duffelFlightBooking.findUnique({
      where: { id },
    });
    return raw ? new DuffelFlightBooking(raw) : null;
  }

  async create(booking: DuffelFlightBooking): Promise<DuffelFlightBooking> {
    const data = booking.toPersistence();
    const raw = await this.db.duffelFlightBooking.create({
      data: {
        ...data,
        passengers: data.passengers as Prisma.InputJsonValue,
        slices: data.slices as Prisma.InputJsonValue,
      },
    });
    booking.flushEvents();
    return new DuffelFlightBooking(raw);
  }

  async update(booking: DuffelFlightBooking): Promise<DuffelFlightBooking> {
    const data = booking.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.duffelFlightBooking.update({
      where: { id },
      data: {
        ...update,
        passengers: data.passengers as Prisma.InputJsonValue,
        slices: data.slices as Prisma.InputJsonValue,
      },
    });
    booking.flushEvents();
    return new DuffelFlightBooking(raw);
  }

  async findByIdForUpdate(id: string): Promise<DuffelFlightBooking | null> {
    await this.lockRowForUpdate('duffel_flight_bookings', id);
    return this.findById(id);
  }
}
