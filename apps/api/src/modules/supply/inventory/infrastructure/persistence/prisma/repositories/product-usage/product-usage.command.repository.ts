import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { ProductUsage } from '@modules/supply/inventory/domain/entities/product-usage.entity';
import { IProductUsageCommandRepository } from '@modules/supply/inventory/domain/repositories/product-usage/product-usage.command.repository';

@Injectable()
export class ProductUsageCommandRepository
  extends BaseRepository
  implements IProductUsageCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(usage: ProductUsage): Promise<ProductUsage> {
    const data = usage.toPersistence();
    const raw = await this.db.productUsage.create({ data });
    usage.flushEvents();
    return new ProductUsage(raw);
  }
}
