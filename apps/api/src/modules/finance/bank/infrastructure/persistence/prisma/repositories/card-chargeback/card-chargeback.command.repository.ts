import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { ICardChargebackCommandRepository } from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { CardChargeback } from '@modules/finance/bank/domain/entities/card-chargeback.entity';
import { SumActiveChargebacksParams } from '@modules/finance/bank/domain/contracts';
import { ChargebackAlreadyRecordedException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * "Aktif" itiraz: parası geri götürülebilir sayılmayan. `OPEN` (sağlayıcıda,
 * sonuç bekleniyor) + `LOST` (kart sahibine gitti). `WON` düşülmez — para geri
 * geldi. Tek sabit: tavan hesabı bu kümeden türer.
 */
const ACTIVE_STATUSES = ['OPEN', 'LOST'] as const;

@Injectable()
export class CardChargebackCommandRepository
  extends BaseCommandRepository<CardChargeback>
  implements ICardChargebackCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(entity: CardChargeback): Promise<CardChargeback> {
    const data = entity.toPersistence();
    try {
      const raw = await this.db.cardChargeback.create({ data });
      entity.flushEvents();
      return new CardChargeback(raw);
    } catch (error) {
      // Aynı vaka ikinci kez girilirse 127 **iki kez** dolar ve 108 iki kez düşer;
      // mizan yine dengeli göründüğü için hata hiçbir kontrole yakalanmaz. Nihai
      // güvence DB kısıtı; burada yalnız jenerik 500 yerine tipli 409'a çevriliyor.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ChargebackAlreadyRecordedException({
          provider: data.provider,
          caseReference: data.caseReference,
        });
      }
      throw error;
    }
  }

  async findById(id: string): Promise<CardChargeback | null> {
    const raw = await this.db.cardChargeback.findUnique({ where: { id } });
    return raw ? new CardChargeback(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<CardChargeback | null> {
    // Satır yoksa kilitlenecek tuple da yoktur; ardından gelen okuma `null`
    // döner ve çağıran tipli NotFound fırlatır (bkz. `lockRowForUpdate`).
    await this.lockRowForUpdate('card_chargebacks', id);
    return this.findById(id);
  }

  async sumActiveBySource(
    params: SumActiveChargebacksParams
  ): Promise<Decimal> {
    const result = await this.db.cardChargeback.aggregate({
      where: {
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      _sum: { amount: true },
    });

    return new Decimal(result._sum.amount?.toString() ?? '0');
  }

  async update(entity: CardChargeback): Promise<CardChargeback> {
    const { id, ...update } = entity.toPersistence();
    const raw = await this.db.cardChargeback.update({
      where: { id },
      data: update,
    });
    entity.flushEvents();
    return new CardChargeback(raw);
  }
}
