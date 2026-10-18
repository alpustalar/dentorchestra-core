import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';

export const FINANCIAL_EVENT_COMMAND_REPOSITORY = Symbol(
  'IFinancialEventCommandRepository'
);

export interface IFinancialEventCommandRepository {
  /**
   * Append-only ekleme (update yok). `dedupeKey` çakışırsa **hiçbir şey yazmaz**
   * ve `null` döner.
   *
   * `null` dönüşünün nedeni: bu komut çoğu zaman çağıranın transaction'ı içinde
   * (fatura kesimi, POS satışı, kasa kapanışı) çalışır. Çakışmayı exception ile
   * bildirseydik PostgreSQL o transaction'ı **abort** ederdi; ardından "kazananı
   * oku" kurtarma sorgusu da aynı ölü transaction'da çalışıp patlar ve mükerrer
   * bir isteğe idempotent cevap vermek yerine tüm iş işlemi geri sarılırdı.
   * `ON CONFLICT DO NOTHING` (Prisma: `skipDuplicates`) transaction'ı ayakta
   * tutar; çağıran kazananı aynı transaction içinde okuyabilir.
   */
  appendIfAbsent(event: FinancialEvent): Promise<FinancialEvent | null>;

  /**
   * Idempotency anahtarıyla mevcut olay. Yeni olay yazılıp yazılmayacağı kararını
   * beslediği için Command Context'e aittir.
   */
  findByDedupeKey(dedupeKey: string): Promise<FinancialEvent | null>;

  /**
   * Verilen aralıkta fişlenmemiş (hiç fişi olmayan ya da fişi DRAFT kalan) olay
   * sayısı. Dönem kapanışının ön koşulunu beslediği — yani bir mutasyonu kapıda
   * durdurduğu — için Command Context'e aittir: replica gecikmesiyle "0 kaldı"
   * görülürse dönem, fişsiz olaylar varken kapanır ve o olaylar bir daha
   * fişlenemez (mizan kalıcı eksik).
   */
  countUnpostedInRange(params: UnpostedRangeParams): Promise<number>;
}

export interface UnpostedRangeParams {
  clinicId: string;
  from: Date;
  to: Date;
  /** Fiş üretimi beklenen olay tipleri (`POSTABLE_FINANCIAL_EVENT_TYPES`). */
  types: readonly FinancialEventType[];
}

/**
 * Klinik kapsamı olmayan tarama parametresi — zamanlanmış süpürme işi bütün
 * defterlerde fişlenmemiş olay arar, sonra bulduğu her klinik için backfill'i
 * ayrı ayrı çalıştırır.
 */
export interface UnpostedScanParams {
  from: Date;
  to: Date;
  /** Fiş üretimi beklenen olay tipleri (`POSTABLE_FINANCIAL_EVENT_TYPES`). */
  types: readonly FinancialEventType[];
}
