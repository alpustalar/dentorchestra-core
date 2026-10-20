import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { ICardChargebackQueryRepository } from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { FindCardChargebacksFilter } from '@modules/finance/bank/domain/contracts';
import { CardChargeback as ICardChargeback } from '@model-schema/CardChargebackSchema';
import { Paginated } from '@common/interfaces/paginated.type';

@Injectable()
export class CardChargebackQueryRepository
  extends BaseRepository
  implements ICardChargebackQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByClinic(
    filter: FindCardChargebacksFilter
  ): Promise<Paginated<ICardChargeback>> {
    const where: Record<string, unknown> = { clinicId: filter.clinicId };
    if (filter.status) where.status = filter.status;

    const result = await paginate({
      delegate: this.db.cardChargeback,
      pagination: filter.pagination,
      where,
    });

    return {
      items: result.items as unknown as ICardChargeback[],
      total: result.total,
    };
  }
}
