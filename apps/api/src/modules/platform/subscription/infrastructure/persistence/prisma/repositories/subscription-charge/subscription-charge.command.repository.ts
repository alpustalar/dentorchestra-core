import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { SubscriptionCharge } from '@modules/platform/subscription/domain/entities/subscription-charge.entity';
import { ISubscriptionChargeCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-charge/subscription-charge.command.repository';
import { SubscriptionChargeStatusSchema } from '@input-type-schemas/SubscriptionChargeStatusSchema';

@Injectable()
export class SubscriptionChargeCommandRepository
  extends BaseRepository
  implements ISubscriptionChargeCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Tekillik çarpışması (P2002) bir HATA DEĞİL, beklenen cevaptır: aynı dönemi
   * başka bir çalıştırma sahiplenmiş. Exception'a çevirmek çağıranı "para
   * çekmeli miyim" kararından mahrum bırakırdı.
   */
  async claim(charge: SubscriptionCharge): Promise<SubscriptionCharge | null> {
    try {
      const raw = await this.db.subscriptionCharge.create({
        data: charge.toPersistence(),
      });
      charge.flushEvents();
      return new SubscriptionCharge(raw);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async findByPeriod(
    subscriptionId: string,
    periodStart: Date
  ): Promise<SubscriptionCharge | null> {
    const raw = await this.db.subscriptionCharge.findUnique({
      where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
    });
    return raw ? new SubscriptionCharge(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<SubscriptionCharge | null> {
    await this.lockRowForUpdate('subscription_charges', id);
    const raw = await this.db.subscriptionCharge.findUnique({ where: { id } });
    return raw ? new SubscriptionCharge(raw) : null;
  }

  async update(charge: SubscriptionCharge): Promise<SubscriptionCharge> {
    const data = charge.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.subscriptionCharge.update({
      where: { id },
      data: update,
    });
    charge.flushEvents();
    return new SubscriptionCharge(raw);
  }

  async findUnresolved(olderThan: Date): Promise<SubscriptionCharge[]> {
    const rows = await this.db.subscriptionCharge.findMany({
      where: {
        status: SubscriptionChargeStatusSchema.enum.PENDING,
        createdAt: { lt: olderThan },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((raw) => new SubscriptionCharge(raw));
  }
}
