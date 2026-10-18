import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { IProductBatchCommandRepository } from '@modules/supply/inventory/domain/repositories/product-batch/product-batch.command.repository';
import { ProductBatch } from '@modules/supply/inventory/domain/entities/product-batch.entity';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

@Injectable()
export class ProductBatchCommandRepository
  extends BaseCommandRepository<ProductBatch>
  implements IProductBatchCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string) {
    const raw = await this.db.productBatch.findUnique({ where: { id } });
    return raw ? new ProductBatch(raw) : null;
  }

  async findAvailableByProduct(
    productId: string,
    clinicId: string
  ): Promise<ProductBatch[]> {
    const rows = await this.db.productBatch.findMany({
      where: {
        productId,
        clinicId,
        quantity: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: DateTimeManager.create() } },
        ],
      },
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map((raw) => new ProductBatch(raw));
  }

  async sumOnHandByProduct(productId: string): Promise<Decimal> {
    const result = await this.db.productBatch.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    return new Decimal((result._sum.quantity ?? 0).toString());
  }

  async create(batch: ProductBatch): Promise<ProductBatch> {
    const data = batch.toPersistence();
    const raw = await this.db.productBatch.create({ data });
    batch.flushEvents();
    return new ProductBatch(raw);
  }

  async update(batch: ProductBatch): Promise<ProductBatch> {
    const create = batch.toPersistence();
    const { id, ...data } = create;
    const raw = await this.db.productBatch.update({
      where: { id },
      data,
    });
    batch.flushEvents();
    return new ProductBatch(raw);
  }

  async updateMany(batches: ProductBatch[]): Promise<void> {
    const prismaQueries = batches.map((batch) => {
      const create = batch.toPersistence();
      const { id, ...data } = create;
      return this.db.productBatch.update({
        where: { id },
        data,
      });
    });

    if (txStorage.getStore()?.tx) {
      await Promise.all(prismaQueries);
    } else {
      await this.prisma.$transaction(prismaQueries);
    }

    batches.forEach((batch) => batch.flushEvents());
  }
}
