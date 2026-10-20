import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import {
  ExternalWorkOrderWithItems,
  FindWorkOrdersFilter,
  WorkOrderSummary,
} from '@modules/supply/work-order/domain/contracts';
import { Paginated } from '@common/interfaces/paginated.type';
import { ExternalWorkOrderStatusSchema } from '@input-type-schemas/ExternalWorkOrderStatusSchema';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { IExternalWorkOrderQueryRepository } from '@modules/supply/work-order/domain/repositories/external-work/external-work.query.repository';

/** Teslim alınmamış — terminin hâlâ anlamlı olduğu durumlar (gecikme filtresi). */
const OPEN_STATUSES = [
  ExternalWorkOrderStatusSchema.enum.SENT,
  ExternalWorkOrderStatusSchema.enum.IN_PROGRESS,
  ExternalWorkOrderStatusSchema.enum.TRY_IN,
  ExternalWorkOrderStatusSchema.enum.READY,
];

@Injectable()
export class ExternalWorkOrderQueryRepository
  extends BaseRepository
  implements IExternalWorkOrderQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<ExternalWorkOrderWithItems | null> {
    const raw = await this.db.externalWorkOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    return raw ? (raw as unknown as ExternalWorkOrderWithItems) : null;
  }

  async findByClinic(
    filter: FindWorkOrdersFilter
  ): Promise<Paginated<ExternalWorkOrderWithItems>> {
    const result = await paginate({
      delegate: this.db.externalWorkOrder,
      pagination: filter.pagination,
      where: this.buildWhere(filter),
      include: { items: true },
    });

    return {
      items: result.items as unknown as ExternalWorkOrderWithItems[],
      total: result.total,
    };
  }

  async summarizeByClinic(
    clinicId: string,
    now: Date
  ): Promise<WorkOrderSummary> {
    const [grouped, overdueCount] = await Promise.all([
      this.db.externalWorkOrder.groupBy({
        by: ['status'],
        where: { clinicId },
        _count: { _all: true },
      }),
      this.db.externalWorkOrder.count({
        where: {
          clinicId,
          dueDate: { lt: now },
          status: { in: OPEN_STATUSES },
        },
      }),
    ]);

    const byStatus = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    return { byStatus, overdueCount };
  }

  private buildWhere(
    filter: FindWorkOrdersFilter
  ): Prisma.ExternalWorkOrderWhereInput {
    const where: Prisma.ExternalWorkOrderWhereInput = {
      clinicId: filter.clinicId,
    };

    if (filter.status) where.status = filter.status;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.patientId) where.patientId = filter.patientId;

    // Gecikme filtresi: termini geçmiş VE hâlâ tedarikçide olan iş emirleri.
    if (filter.overdue) {
      where.dueDate = { lt: DateTimeManager.create() };
      where.status = filter.status ?? { in: OPEN_STATUSES };
    } else if (filter.dueBefore) {
      where.dueDate = { lt: filter.dueBefore };
    }

    return where;
  }
}
