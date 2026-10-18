import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

/**
 * Bir **kaynak belgenin** defter etkisini storno ile götürür: belge → ekonomik
 * olay (`dedupeKey`) → fiş (`event_id`) zinciri üzerinden ters kaydı atar.
 *
 * Neden ayrı bir olay tipi + posting kuralı değil: "SALES_INVOICE_CANCELLED" gibi
 * yeni bir olay yazıp ters fişi kural motorundan üretmek orijinal fişi `REVERSED`
 * işaretlemez. O zaman defter süzgeci (`LEDGER_EFFECTIVE_ENTRY_STATUSES`) iki
 * fişi de etkin sayar — tutarlar doğru netleşir ama orijinal fiş sonsuza kadar
 * "geçerli" görünür, `reversedById` izi kurulmaz ve ikinci bir iptal mükerrer
 * storno üretebilir (CLAUDE.md finans kuralı 8). Bu yüzden iptal, mevcut storno
 * mekanizmasını (`ReverseJournalEntryCommand`) kullanır.
 *
 * Dönüş: storno fişinin id'si.
 */
export class ReverseJournalEntryByEventCommand implements ICommand {
  readonly __responseType!: string;

  constructor(
    public readonly payload: {
      /** Belgenin ekonomik olay idempotency anahtarı (`FinancialEventDedupeKeys`). */
      readonly dedupeKey: string;
      readonly reason: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
