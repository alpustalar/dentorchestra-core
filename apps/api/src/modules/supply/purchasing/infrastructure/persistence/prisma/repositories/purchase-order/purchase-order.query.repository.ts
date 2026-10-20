import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { IPurchaseOrderQueryRepository } from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  FindGrniAccrualOrdersFilter,
  FindPurchaseOrdersFilter,
  GrniAccrualOrderRecord,
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

  async findGrniAccrualOrders(
    filter: FindGrniAccrualOrdersFilter
  ): Promise<GrniAccrualOrderRecord[]> {
    const rows = await this.db.purchaseOrder.findMany({
      where: {
        clinicId: filter.clinicId,
        // Kabulü olan siparişler (tahakkuk adayı) ya da faturası eşleşmiş olanlar (faturası kabulünden
        // fazla stok uyarısı). Hiçbiri olmayan siparişin sapması tanım gereği sıfırdır.
        OR: [
          { receipts: { some: { receivedAt: { lte: filter.asOf } } } },
          { invoicedTotal: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        supplierId: true,
        orderDate: true,
        currency: true,
        items: { select: { id: true, productId: true } },
        receipts: {
          where: { receivedAt: { lte: filter.asOf } },
          select: {
            source: true,
            lines: {
              select: { itemId: true, quantity: true, unitPrice: true },
            },
          },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      supplierId: row.supplierId,
      orderDate: row.orderDate,
      currency: row.currency,
      items: row.items,
      receipts: row.receipts.map((receipt) => ({
        source: receipt.source,
        lines: receipt.lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
        })),
      })),
    }));
  }
}
