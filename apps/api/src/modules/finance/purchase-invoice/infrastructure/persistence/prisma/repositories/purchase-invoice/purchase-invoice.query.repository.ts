import { Injectable } from '@nestjs/common';
import { Pagination, PurchaseInvoice as IPurchaseInvoice } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { IPurchaseInvoiceQueryRepository } from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import {
  FindInvoiceAmountsByOrdersFilter,
  PurchaseInvoiceOrderAmount,
} from '@modules/finance/purchase-invoice/domain/contracts/purchase-invoice';
import { PurchaseInvoiceStatusSchema } from '@shared';

/** Okuma tarafı: entity hidrate edilmez (veri doğrudan HTTP sınırını geçiyor). */
@Injectable()
export class PurchaseInvoiceQueryRepository
  extends BaseRepository
  implements IPurchaseInvoiceQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findManyByClinic(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IPurchaseInvoice[]; total: number }> {
    return paginate({
      delegate: this.db.purchaseInvoice,
      pagination,
      where: { clinicId },
    });
  }

  async findAmountsByOrderIdsAsOf(
    filter: FindInvoiceAmountsByOrdersFilter
  ): Promise<PurchaseInvoiceOrderAmount[]> {
    if (filter.orderIds.length === 0) return [];

    const { DRAFT, CANCELLED } = PurchaseInvoiceStatusSchema.enum;
    const rows = await this.db.purchaseInvoice.findMany({
      where: {
        clinicId: filter.clinicId,
        purchaseOrderId: { in: [...filter.orderIds] },
        invoiceDate: { lte: filter.asOf },
        // DRAFT muhasebeleşmedi (defterde yok); iptal EDİLMİŞ fatura ise iptal `asOf`'tan
        // SONRA olduysa o anda hâlâ defterdeydi — sayılır. (İptal bağı silmez: `cancel()`
        // sipariş bağını iz olarak bırakır.)
        status: { not: DRAFT },
        OR: [
          { status: { not: CANCELLED } },
          { cancelledAt: { gt: filter.asOf } },
        ],
      },
      select: {
        id: true,
        purchaseOrderId: true,
        invoiceDate: true,
        netTotal: true,
        currency: true,
        lineAccountCode: true,
      },
      orderBy: [{ invoiceDate: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      invoiceId: row.id,
      // where süzgeci null'ı dışlar; Prisma tipi nullable kalır.
      purchaseOrderId: row.purchaseOrderId as string,
      invoiceDate: row.invoiceDate,
      netTotal: row.netTotal.toFixed(2),
      currency: row.currency,
      lineAccountCode: row.lineAccountCode,
    }));
  }
}
