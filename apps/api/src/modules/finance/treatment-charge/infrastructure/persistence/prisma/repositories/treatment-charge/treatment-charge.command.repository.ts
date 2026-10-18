import { Injectable } from '@nestjs/common';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { ITreatmentChargeCommandRepository } from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.command.repository';

@Injectable()
export class TreatmentChargeCommandRepository
  extends BaseCommandRepository<TreatmentCharge>
  implements ITreatmentChargeCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(entity: TreatmentCharge): Promise<TreatmentCharge> {
    const data = entity.toPersistence();
    const raw = await this.db.treatmentCharge.create({ data });
    entity.flushEvents();
    return new TreatmentCharge(raw);
  }

  async findById(id: string): Promise<TreatmentCharge | null> {
    const raw = await this.db.treatmentCharge.findUnique({ where: { id } });
    return raw ? new TreatmentCharge(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<TreatmentCharge | null> {
    await this.lockRowForUpdate('treatment_charges', id);
    return this.findById(id);
  }

  async update(entity: TreatmentCharge): Promise<TreatmentCharge> {
    const data = entity.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.treatmentCharge.update({
      where: { id },
      data: update,
    });
    entity.flushEvents();
    return new TreatmentCharge(raw);
  }

  /**
   * Fatura/tahsilat tutarını besleyen okuma olduğu için Command Repo'da durur:
   * karar veren okumanın yazmayla aynı transaction ve tutarlılık kapsamında
   * kalması gerekir (bkz. CQRS — Command Handler'da Command Repo kuralı).
   */
  async findActiveByAppointmentId(
    appointmentId: string
  ): Promise<TreatmentCharge[]> {
    const rows = await this.db.treatmentCharge.findMany({
      where: { appointmentId, voidedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((raw) => new TreatmentCharge(raw));
  }

  /**
   * Kilit ve okuma **tek metotta**: `FOR UPDATE` yalnız çevreleyen transaction
   * boyunca tutulur, bölünürse sıra bozulur ve kilit sessizce etkisiz kalır.
   * Tablo adı sabit (kullanıcı girdisi değil) — enjeksiyon riski yok.
   */
  async findActiveByAppointmentIdForUpdate(
    appointmentId: string
  ): Promise<TreatmentCharge[]> {
    this.assertInTransaction('findActiveByAppointmentIdForUpdate');

    await this.db.$queryRaw`
      SELECT id FROM "treatment_charges"
      WHERE appointment_id = ${appointmentId} AND voided_at IS NULL
      FOR UPDATE
    `;

    return this.findActiveByAppointmentId(appointmentId);
  }
}
