import { Injectable } from '@nestjs/common';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { ClinicFinanceSettings } from '@modules/organization/clinic/domain/entities/clinic-finance-settings.entity';
import { IClinicFinanceSettingsCommandRepository } from '@modules/organization/clinic/domain/repositories/clinic-finance-settings/clinic-finance-settings.command.repository';

@Injectable()
export class ClinicFinanceSettingsCommandRepository
  extends BaseCommandRepository<ClinicFinanceSettings>
  implements IClinicFinanceSettingsCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<ClinicFinanceSettings | null> {
    const raw = await this.db.clinicFinanceSettings.findUnique({
      where: { id },
    });
    return raw ? new ClinicFinanceSettings(raw) : null;
  }

  async findByClinicId(clinicId: string): Promise<ClinicFinanceSettings | null> {
    const raw = await this.db.clinicFinanceSettings.findUnique({
      where: { clinicId },
    });
    return raw ? new ClinicFinanceSettings(raw) : null;
  }

  async upsertByClinicId(
    entity: ClinicFinanceSettings
  ): Promise<ClinicFinanceSettings> {
    const data = entity.toPersistence();
    const { id: _id, ...update } = data;
    const raw = await this.db.clinicFinanceSettings.upsert({
      where: { clinicId: data.clinicId },
      create: data,
      update,
    });
    return new ClinicFinanceSettings(raw);
  }

  async create(entity: ClinicFinanceSettings): Promise<ClinicFinanceSettings> {
    const data = entity.toPersistence();
    const raw = await this.db.clinicFinanceSettings.create({ data });
    return new ClinicFinanceSettings(raw);
  }

  async update(entity: ClinicFinanceSettings): Promise<ClinicFinanceSettings> {
    const data = entity.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.clinicFinanceSettings.update({
      where: { id },
      data: update,
    });
    return new ClinicFinanceSettings(raw);
  }
}
