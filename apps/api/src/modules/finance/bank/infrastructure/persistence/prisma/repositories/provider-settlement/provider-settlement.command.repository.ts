import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { IProviderSettlementCommandRepository } from '@modules/finance/bank/domain/repositories/provider-settlement/provider-settlement.command.repository';
import { ProviderSettlement } from '@modules/finance/bank/domain/entities/provider-settlement.entity';
import { ProviderSettlementAlreadyRecordedException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';

@Injectable()
export class ProviderSettlementCommandRepository
  extends BaseCommandRepository<ProviderSettlement>
  implements IProviderSettlementCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(entity: ProviderSettlement): Promise<ProviderSettlement> {
    const data = entity.toPersistence();
    try {
      const raw = await this.db.providerSettlement.create({ data });
      entity.flushEvents();
      return new ProviderSettlement(raw);
    } catch (error) {
      // Aynı payout ikinci kez girilirse 108 **iki kez** kapanır: bakiye eksiye
      // düşer, 102 fazla yazılır ve mizan yine dengeli göründüğü için hata
      // hiçbir kontrole yakalanmaz. Nihai güvence DB kısıtı; burada yalnız
      // jenerik 500 yerine tipli 409'a çevriliyor.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ProviderSettlementAlreadyRecordedException({
          provider: data.provider,
          reference: data.reference,
        });
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ProviderSettlement | null> {
    const raw = await this.db.providerSettlement.findUnique({ where: { id } });
    return raw ? new ProviderSettlement(raw) : null;
  }

  async update(entity: ProviderSettlement): Promise<ProviderSettlement> {
    const { id, ...update } = entity.toPersistence();
    const raw = await this.db.providerSettlement.update({
      where: { id },
      data: update,
    });
    entity.flushEvents();
    return new ProviderSettlement(raw);
  }
}
