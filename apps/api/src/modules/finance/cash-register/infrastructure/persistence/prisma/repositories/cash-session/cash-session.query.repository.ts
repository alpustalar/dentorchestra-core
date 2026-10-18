import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import {
  CashSessionWithMovements,
  FindCashSessionsFilter,
} from '@modules/finance/cash-register/domain/contracts';
import { CashSession as ICashSession } from '@model-schema/CashSessionSchema';
import { Paginated } from '@common/interfaces/paginated.type';
import { ICashSessionQueryRepository } from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.query.repository';

@Injectable()
export class CashSessionQueryRepository
  extends BaseRepository
  implements ICashSessionQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<ICashSession | null> {
    return this.db.cashSession.findUnique({ where: { id } });
  }

  async findByIdWithMovements(
    id: string
  ): Promise<CashSessionWithMovements | null> {
    return this.db.cashSession.findUnique({
      where: { id },
      include: { movements: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  async findByClinic(
    filter: FindCashSessionsFilter
  ): Promise<Paginated<ICashSession>> {
    const where: Prisma.CashSessionWhereInput = { clinicId: filter.clinicId };
    if (filter.cashRegisterId) where.cashRegisterId = filter.cashRegisterId;
    if (filter.status) where.status = filter.status;
    // Sayım farkı olan kapanışlar: fark kapanışta deftere yazıldığı için
    // (689 kasa açığı / 679 kasa fazlası) denetlenebilir olmalı. `null` olanlar
    // henüz kapanmamış oturumlardır, farkı yoktur.
    if (filter.hasDifference) {
      where.difference = { not: new Prisma.Decimal(0) };
    }

    return await paginate({
      delegate: this.db.cashSession,
      pagination: filter.pagination,
      where,
    });
  }

  findOpenByRegister(cashRegisterId: string): Promise<ICashSession | null> {
    return this.db.cashSession.findFirst({
      where: { cashRegisterId, status: 'OPEN' },
    });
  }
}
