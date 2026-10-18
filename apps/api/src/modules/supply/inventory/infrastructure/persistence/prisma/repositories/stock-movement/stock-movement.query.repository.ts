import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { Pagination, StockMovement as IStockMovement } from '@shared';
import { IStockMovementQueryRepository } from '@modules/supply/inventory/domain/repositories/stock-movement/stock-movement.query.repository';
import { BatchQuantityDriftLine } from '@modules/supply/inventory/domain/contracts/stock-movement/stock-movement-queries.contracts';

/** Okuma tarafı: entity hidrate edilmez (veri doğrudan HTTP sınırını geçiyor). */
@Injectable()
export class StockMovementQueryRepository
  extends BaseRepository
  implements IStockMovementQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findManyByClinic(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IStockMovement[]; total: number }> {
    return paginate({
      delegate: this.db.stockMovement,
      pagination,
      where: { clinicId },
    });
  }

  findManyByProduct(
    productId: string,
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IStockMovement[]; total: number }> {
    return paginate({
      delegate: this.db.stockMovement,
      pagination,
      where: { productId, clinicId },
    });
  }

  /**
   * Ham SQL: karşılaştırma iki tablonun **toplamları** arasında (parti satırı ↔
   * hareket toplamı). Prisma ile yapılsaydı her parti için ayrı `aggregate`
   * çağrısı gerekirdi (N+1) ve eşitlik süzgeci uygulamada kalırdı — yani bütün
   * partiler belleğe çekilirdi.
   *
   * `direction::text` cast'i zorunlu: enum kolonu doğrudan string literal ile
   * karşılaştırılamaz.
   */
  async getBatchQuantityDrift(
    clinicId: string
  ): Promise<BatchQuantityDriftLine[]> {
    const rows = await this.db.$queryRaw<
      {
        batch_id: string;
        product_id: string;
        product_name: string;
        stock_code: string;
        lot_number: string | null;
        currency: string;
        batch_quantity: Prisma.Decimal;
        movement_quantity: Prisma.Decimal;
        value_drift: Prisma.Decimal;
        batch_updated_at: Date;
      }[]
    >(Prisma.sql`
      WITH movement_totals AS (
        SELECT batch_id,
               SUM(CASE WHEN direction::text = 'IN' THEN quantity ELSE -quantity END) AS movement_quantity
        FROM stock_movements
        WHERE batch_id IS NOT NULL
          AND clinic_id = ${clinicId}
        GROUP BY batch_id
      )
      SELECT b.id           AS batch_id,
             b.product_id,
             p.name         AS product_name,
             p.stock_code   AS stock_code,
             b.lot_number,
             b.currency::text AS currency,
             b.quantity     AS batch_quantity,
             COALESCE(m.movement_quantity, 0) AS movement_quantity,
             (b.quantity - COALESCE(m.movement_quantity, 0)) * b.purchase_price AS value_drift,
             b.updated_at   AS batch_updated_at
      FROM product_batches b
      JOIN products p ON p.id = b.product_id
      LEFT JOIN movement_totals m ON m.batch_id = b.id
      WHERE b.clinic_id = ${clinicId}
        AND b.quantity <> COALESCE(m.movement_quantity, 0)
      ORDER BY ABS((b.quantity - COALESCE(m.movement_quantity, 0)) * b.purchase_price) DESC
    `);

    return rows.map((row) => {
      const batchQuantity = new Decimal(row.batch_quantity.toString());
      const movementQuantity = new Decimal(row.movement_quantity.toString());

      return {
        batchId: row.batch_id,
        productId: row.product_id,
        productName: row.product_name,
        stockCode: row.stock_code,
        lotNumber: row.lot_number,
        currency: row.currency,
        batchQuantity: batchQuantity.toString(),
        movementQuantity: movementQuantity.toString(),
        quantityDrift: batchQuantity.minus(movementQuantity).toString(),
        valueDrift: new Decimal(row.value_drift.toString()).toFixed(2),
        batchUpdatedAt: row.batch_updated_at,
      };
    });
  }
}
