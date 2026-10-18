import { Injectable } from '@nestjs/common';
import { PartyOriginType, Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Party } from '@modules/finance/party/domain/entities/party.entity';
import { PartyAlreadyExistsException } from '@modules/finance/party/domain/exceptions/party.exceptions';
import { IPartyCommandRepository } from '@modules/finance/party/domain/repositories/party/party.command.repository';

@Injectable()
export class PartyCommandRepository
  extends BaseRepository
  implements IPartyCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByOrigin(
    clinicId: string,
    originType: PartyOriginType,
    originId: string
  ): Promise<Party | null> {
    const raw = await this.db.party.findUnique({
      where: {
        clinicId_originType_originId: { clinicId, originType, originId },
      },
    });
    return raw ? new Party(raw) : null;
  }

  async create(party: Party): Promise<Party> {
    const data = party.toPersistence();
    try {
      const raw = await this.db.party.create({ data });
      party.flushEvents();
      return new Party(raw);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PartyAlreadyExistsException(
          data.originType,
          data.originId ?? ''
        );
      }
      throw error;
    }
  }

  async update(party: Party): Promise<Party> {
    const data = party.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.party.update({
      where: { id },
      data: update,
    });
    party.flushEvents();
    return new Party(raw);
  }
}
