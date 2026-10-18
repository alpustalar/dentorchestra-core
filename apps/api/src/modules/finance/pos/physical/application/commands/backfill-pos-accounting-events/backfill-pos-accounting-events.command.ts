import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { BackfillPosAccountingEvents } from '@shared/modules/pos/types/commands';
import { BackfillPosAccountingEventsResponse } from './backfill-pos-accounting-events.response';

/**
 * Muhasebe köprüsü kurulamamış POS tahsilatlarını yeniden köprüler.
 *
 * Satış akışında köprü hatası **yutulur** (kart çekildi, geri sarmak defteri
 * bozardı) ve olay hiç yazılmadığı için `sweep-unposted-financial-events` onu
 * göremez. CLAUDE.md finans kuralı 4 bu yüzden telafi yolunu zorunlu kılar:
 * eksikler `FindUnbridgedPosTransactionsQuery` ile listelenir, bu komut
 * yeniden dener. `dedupeKey` sayesinde tur tekrar tekrar çalıştırılabilir.
 */
export class BackfillPosAccountingEventsCommand implements ICommand {
  readonly __responseType!: BackfillPosAccountingEventsResponse;

  constructor(
    public readonly payload: {
      readonly data: BackfillPosAccountingEvents;
      readonly ctx: IGetContext;
    }
  ) {}
}
