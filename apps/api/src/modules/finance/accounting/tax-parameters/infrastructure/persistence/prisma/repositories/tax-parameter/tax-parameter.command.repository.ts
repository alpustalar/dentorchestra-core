import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaxParameterKeyType as TaxParameterKey } from '@input-type-schemas/TaxParameterKeySchema';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';
import { TaxParameter } from '@modules/finance/accounting/tax-parameters/domain/entities/tax-parameter.entity';
import { ITaxParameterCommandRepository } from '@modules/finance/accounting/tax-parameters/domain/repositories/tax-parameter/tax-parameter.command.repository';
import { TaxParameterConcurrentUpdateException } from '@modules/finance/accounting/tax-parameters/domain/exceptions';

@Injectable()
export class TaxParameterCommandRepository
  extends BaseCommandRepository<TaxParameter>
  implements ITaxParameterCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<TaxParameter | null> {
    const raw = await this.db.taxParameter.findUnique({ where: { id } });
    return raw ? new TaxParameter(raw) : null;
  }

  async findOpenForUpdate(
    clinicId: string,
    key: TaxParameterKey
  ): Promise<TaxParameter | null> {
    const open = await this.db.taxParameter.findFirst({
      where: { clinicId, key, validTo: null },
      orderBy: { validFrom: 'desc' },
      select: { id: true },
    });
    // Açık sürüm yoksa kilitlenecek satır da yok; ilk sürüm doğrudan açılır.
    if (!open) return null;

    await this.lockRowForUpdate('tax_parameters', open.id);
    const raw = await this.db.taxParameter.findUnique({
      where: { id: open.id },
    });
    return raw ? new TaxParameter(raw) : null;
  }

  async existsForClinic(clinicId: string): Promise<boolean> {
    const count = await this.db.taxParameter.count({ where: { clinicId } });
    return count > 0;
  }

  async create(entity: TaxParameter): Promise<TaxParameter> {
    const data = entity.toPersistence();
    try {
      const raw = await this.db.taxParameter.create({ data });
      entity.flushEvents();
      return new TaxParameter(raw);
    } catch (error) {
      // Kısmî unique index (`(clinic_id, key) WHERE valid_to IS NULL`) ikinci açık
      // sürümü reddeder. Bu kısıt tek gerçek korumadır: ilk sürüm henüz yokken
      // kilitlenecek satır da olmadığı için iki eşzamanlı istek arasında
      // serileştirilecek bir şey kalmıyor.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new TaxParameterConcurrentUpdateException(
          data.clinicId,
          data.key
        );
      }
      throw error;
    }
  }

  async update(entity: TaxParameter) {
    const data = entity.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.taxParameter.update({
      where: { id },
      data: update,
    });
    entity.flushEvents();
    return new TaxParameter(raw);
  }

  async createMany(entities: TaxParameter[]): Promise<void> {
    const queries = entities.map((entity) =>
      this.db.taxParameter.create({ data: entity.toPersistence() })
    );

    if (txStorage.getStore()?.tx) {
      await Promise.all(queries);
    } else {
      await this.prisma.$transaction(queries);
    }

    entities.forEach((entity) => entity.flushEvents());
  }
}
