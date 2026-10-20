import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { IClinicExceptionQueryRepository } from '@modules/organization/clinic/domain/repositories/clinic-exception/clinic-exception.query.repository';
import { ClinicException } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@Injectable()
export class ClinicExceptionQueryRepository
  extends BaseRepository
  implements IClinicExceptionQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findExceptionsByDateRange(
    clinicId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ClinicException[]> {
    const normalizedStart = DateTimeManager.create(startDate);
    normalizedStart.setUTCHours(0, 0, 0, 0);
    const normalizedEnd = DateTimeManager.create(endDate);
    normalizedEnd.setUTCHours(0, 0, 0, 0);

    return this.db.clinicException.findMany({
      where: {
        clinicId,
        date: { gte: normalizedStart, lte: normalizedEnd },
      },
    });
  }

  async findClosedExceptionByDate(
    clinicId: string,
    date: Date
  ): Promise<Partial<ClinicException> | null> {
    const startOfDay = DateTimeManager.create(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    return this.db.clinicException.findFirst({
      where: {
        clinicId,
        date: startOfDay,
        isClosed: true,
      },
      select: {
        isClosed: true,
        reason: true,
        date: true,
      },
    });
  }

  async findExceptionByClinicAndDate(
    clinicId: string,
    date: Date
  ): Promise<ClinicException | null> {
    const normalizedDate = DateTimeManager.create(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return this.db.clinicException.findUnique({
      where: {
        clinicId_date: {
          clinicId,
          date: normalizedDate,
        },
      },
    });
  }
}
