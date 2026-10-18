import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import {
  IFinancialEventCommandRepository,
  UnpostedRangeParams,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import { unpostedFinancialEventWhere } from './financial-event-unposted.query';

@Injectable()
export class FinancialEventCommandRepository
  extends BaseRepository
  implements IFinancialEventCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByDedupeKey(dedupeKey: string): Promise<FinancialEvent | null> {
    const raw = await this.db.financialEvent.findUnique({
      where: { dedupeKey },
    });
    return raw ? new FinancialEvent(raw) : null;
  }

  /**
   * `createMany` + `skipDuplicates` bilinçli bir tercihtir: tekil `create`
   * çakışmada P2002 fırlatıp **çağıranın transaction'ını abort** ederdi (bkz.
   * interface notu). `skipDuplicates` PostgreSQL'de `ON CONFLICT DO NOTHING`'e
   * çevrilir; transaction sağ kalır, `count === 0` çakışmayı bildirir.
   *
   * Event'ler yalnız satır **gerçekten yazıldığında** flush edilir — aksi hâlde
   * yazılmamış bir kayıt için fiş üretimi tetiklenirdi.
   */
  async appendIfAbsent(event: FinancialEvent): Promise<FinancialEvent | null> {
    const data = event.toPersistence();

    const { count } = await this.db.financialEvent.createMany({
      data: [{ ...data, payload: data.payload as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });

    if (count === 0) return null;

    event.flushEvents();
    return new FinancialEvent(data);
  }

  countUnpostedInRange(params: UnpostedRangeParams): Promise<number> {
    return this.db.financialEvent.count({
      where: unpostedFinancialEventWhere(params),
    });
  }
}
