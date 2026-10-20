import { Injectable } from '@nestjs/common';
import { AccountingPeriod as IAccountingPeriod } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { IAccountingPeriodQueryRepository } from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.query.repository';
import { periodCoveringDateWhere } from './accounting-period-date.query';

@Injectable()
export class AccountingPeriodQueryRepository
  extends BaseRepository
  implements IAccountingPeriodQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<IAccountingPeriod | null> {
    return this.db.accountingPeriod.findUnique({ where: { id } });
  }

  findByDate(clinicId: string, date: Date): Promise<IAccountingPeriod | null> {
    return this.db.accountingPeriod.findFirst({
      where: periodCoveringDateWhere(clinicId, date),
    });
  }

  findAllByClinicId(clinicId: string): Promise<IAccountingPeriod[]> {
    return this.db.accountingPeriod.findMany({
      where: { clinicId },
      orderBy: { year: 'desc' },
    });
  }
}
