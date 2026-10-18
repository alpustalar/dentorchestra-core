import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { IPurchaseOrderQueryRepository } from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  FindPurchaseOrdersFilter,
  PurchaseOrderWithItems,
} from '@modules/supply/purchasing/domain/contracts';
import { Paginated } from '@common/interfaces/paginated.type';

@Injectable()
export class PurchaseOrderQueryRepository
  extends BaseRepository
  implements IPurchaseOrderQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<PurchaseOrderWithItems | null> {
    const raw = await this.db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    return raw ? (raw as unknown as PurchaseOrderWithItems) : null;
  }

  async findByClinic(
    filter: FindPurchaseOrdersFilter
  ): Promise<Paginated<PurchaseOrderWithItems>> {
    const where: Record<string, unknown> = { clinicId: filter.clinicId };
    if (filter.status) where.status = filter.status;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.billingStatus) where.billingStatus = filter.billingStatus;

    const result = await paginate({
      delegate: this.db.purchaseOrder,
      pagination: filter.pagination,
      where,
      include: { items: true },
    });

    return {
      items: result.items as unknown as PurchaseOrderWithItems[],
      total: result.total,
    };
  }

  async findReceiptVarianceCandidates(
    clinicId: string
  ): Promise<PurchaseOrderWithItems[]> {
    const rows = await this.db.purchaseOrder.findMany({
      where: {
        clinicId,
        OR: [
          { invoicedTotal: { gt: 0 } },
          { items: { some: { quantityReceived: { gt: 0 } } } },
        ],
      },
      include: { items: true },
      orderBy: { orderDate: 'asc' },
    });

    return rows as unknown as PurchaseOrderWithItems[];
  }
}
