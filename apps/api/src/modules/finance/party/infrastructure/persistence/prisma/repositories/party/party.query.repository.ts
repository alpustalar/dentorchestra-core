import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Pagination, Party as IParty } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { FindPartiesFilter } from '@modules/finance/party/domain/contracts/party';
import { IPartyQueryRepository } from '@modules/finance/party/domain/repositories/party/party.query.repository';

/**
 * Okuma tarafı: entity hidrate edilmez. Cari "ensure" akışının doğal-anahtar
 * okuması (findByOrigin) Command Repo'dadır — orada bir yazma kararını besler.
 */
@Injectable()
export class PartyQueryRepository
  extends BaseRepository
  implements IPartyQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<IParty | null> {
    return this.db.party.findUnique({ where: { id } });
  }

  findByIds(clinicId: string, ids: string[]): Promise<IParty[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.party.findMany({ where: { clinicId, id: { in: ids } } });
  }

  findMany(
    filter: FindPartiesFilter,
    pagination: Pagination
  ): Promise<{ items: IParty[]; total: number }> {
    const where: Prisma.PartyWhereInput = {
      clinicId: filter.clinicId,
      ...(filter.role ? { roles: { has: filter.role } } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    };

    return paginate({ delegate: this.db.party, pagination, where });
  }
}
