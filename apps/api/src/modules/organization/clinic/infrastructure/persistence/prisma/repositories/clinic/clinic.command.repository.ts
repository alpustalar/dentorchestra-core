import { Clinic } from '@modules/organization/clinic/domain/entities/clinic.entity';

import { Injectable } from '@nestjs/common';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { GlobalStatusSchema } from '@input-type-schemas/GlobalStatusSchema';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { IClinicCommandRepository } from '@modules/organization/clinic/domain/repositories/clinic/clinic.command.repository';

@Injectable()
export class ClinicCommandRepository
  extends BaseCommandRepository<Clinic>
  implements IClinicCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<Clinic | null> {
    const raw = await this.db.clinic.findUnique({ where: { id } });
    return raw ? new Clinic(raw) : null;
  }

  async create(entity: Clinic): Promise<Clinic> {
    const data = entity.toPersistence();
    const raw = await this.db.clinic.create({ data });
    entity.flushEvents();
    return new Clinic(raw);
  }

  async softDeleteManyClinicWithAnOrganizationId(
    organizationId: string
  ): Promise<{ deletedCount: number }> {
    const { count: deletedCount } = await this.db.clinic.updateMany({
      where: {
        organizationId,
        status: { not: GlobalStatusSchema.enum.DELETED },
      },
      data: {
        status: GlobalStatusSchema.enum.DELETED,
        deletedAt: DateTimeManager.create(),
      },
    });
    return { deletedCount };
  }

  async update(entity: Clinic): Promise<Clinic> {
    const persistenceData = entity.toPersistence();
    const { id, ...data } = persistenceData;
    const raw = await this.db.clinic.update({
      where: { id },
      data,
    });
    entity.flushEvents();
    return new Clinic(raw);
  }

  async sync(entity: Clinic): Promise<Clinic> {
    const create = entity.toPersistence();
    const { id, ...update } = create;
    const raw = await this.db.clinic.upsert({
      where: { id },
      create,
      update,
    });
    entity.flushEvents();
    return new Clinic(raw);
  }

  async syncMany(entities: Clinic[]): Promise<void> {
    const prismaQueries = entities.map((entity) => {
      const data = entity.toPersistence();
      return this.db.clinic.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
    });

    if (txStorage.getStore()?.tx) {
      await Promise.all(prismaQueries);
    } else {
      await this.prisma.$transaction(prismaQueries);
    }

    entities.forEach((entity) => entity.flushEvents());
  }
}
