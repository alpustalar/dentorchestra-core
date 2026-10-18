import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { Prisma } from '@prisma/client';
import { Pagination, Product as IProduct } from '@shared';

import { Decimal } from 'decimal.js';
import {
  InventoryValuationLine,
  StockLevel,
} from '@modules/supply/inventory/domain/contracts';
import { IProductQueryRepository } from '@modules/supply/inventory/domain/repositories/product/product.query.repository';

@Injectable()
export class ProductQueryRepository
  extends BaseRepository
  implements IProductQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMany(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IProduct[]; total: number }> {
    return paginate({
      delegate: this.db.product,
      pagination,
      where: { clinicId, deletedAt: null, isActive: true },
    });
  }

  /**
   * Kliniğin stok seviyeleri. Liste **ürünlerden** kurulur, partilerden değil:
   * önceki kurgu `product_batches` üzerinden gruplayıp `quantity > 0` süzdüğü
   * için stoğu sıfırlanan ürün listeden tamamen düşüyordu — yani kritik stok
   * uyarısı **en kritik durumu (tükenmiş ürün) hiç göstermiyordu**.
   */
  async getStockLevels(clinicId: string): Promise<StockLevel[]> {
    const products = await this.db.product.findMany({
      where: { clinicId, deletedAt: null, isActive: true },
      select: { id: true, name: true, stockCode: true, criticalStockQty: true },
    });

    if (products.length === 0) return [];

    const rows = await this.db.productBatch.groupBy({
      by: ['productId'],
      where: { clinicId, productId: { in: products.map((p) => p.id) } },
      _sum: { quantity: true },
    });

    const quantityMap = new Map(
      rows.map((row) => [row.productId, row._sum.quantity ?? new Decimal(0)])
    );

    return products.map((product) => {
      const totalQty = new Decimal(
        (quantityMap.get(product.id) ?? 0).toString()
      );
      return {
        productId: product.id,
        productName: product.name,
        stockCode: product.stockCode,
        clinicId,
        totalQuantity: totalQty.toString(),
        criticalStockQty: product.criticalStockQty.toString(),
        isBelowCritical: totalQty.lessThan(product.criticalStockQty),
      };
    });
  }

  async getLowStockAlerts(clinicId: string): Promise<StockLevel[]> {
    const all = await this.getStockLevels(clinicId);
    return all.filter((s) => s.isBelowCritical);
  }

  /**
   * Değerleme toplamı SQL'de alınır: `SUM(quantity * purchase_price)` bir
   * **ifade** toplamıdır, Prisma `groupBy` yalnız kolon toplayabilir. Partileri
   * uygulamaya çekip toplamak binlerce satırı boşuna taşır ve sayfalama
   * gerektirirdi.
   *
   * `quantity <> 0` süzgeci yok: negatif bir parti miktarı (olmaması gerekir,
   * `Quantity.sub` engelliyor) raporda **görünmeli** — sessizce atılırsa veri
   * hatası değerlemeyi şişirir.
   */
  async getInventoryValuation(
    clinicId: string
  ): Promise<InventoryValuationLine[]> {
    const rows = await this.db.$queryRaw<
      {
        product_id: string;
        product_name: string;
        stock_code: string;
        currency: string;
        quantity: Prisma.Decimal;
        value: Prisma.Decimal;
        is_product_deleted: boolean;
      }[]
    >(Prisma.sql`
      SELECT b.product_id,
             p.name       AS product_name,
             p.stock_code AS stock_code,
             b.currency::text AS currency,
             SUM(b.quantity) AS quantity,
             SUM(b.quantity * b.purchase_price) AS value,
             (p.deleted_at IS NOT NULL) AS is_product_deleted
      FROM product_batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.clinic_id = ${clinicId}
      GROUP BY b.product_id, p.name, p.stock_code, b.currency, p.deleted_at
      HAVING SUM(b.quantity) <> 0
      ORDER BY p.name ASC
    `);

    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      stockCode: row.stock_code,
      currency: row.currency,
      quantity: new Decimal(row.quantity.toString()).toString(),
      value: new Decimal(row.value.toString()).toFixed(2),
      isProductDeleted: row.is_product_deleted,
    }));
  }
}
