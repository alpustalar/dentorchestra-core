import { FinancialEvent, Pagination } from '@shared';
import { FindFinancialEventsFilter } from '@modules/finance/accounting/financial-events/domain/contracts/financial-event';
import { UnpostedRangeParams } from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import { UnpostedScanParams } from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';

export const FINANCIAL_EVENT_QUERY_REPOSITORY = Symbol(
  'IFinancialEventQueryRepository'
);

export interface IFinancialEventQueryRepository {
  findById(id: string): Promise<FinancialEvent | null>;
  findMany(
    filter: FindFinancialEventsFilter,
    pagination: Pagination
  ): Promise<{ items: FinancialEvent[]; total: number }>;

  /**
   * Fişlenmemiş olayların listesi — mutabakat ekranı ve backfill komutu için.
   * Karar değil rapor ürettiği için Query Context'e aittir; kapanış kapısı
   * (karar) Command Repo'daki `countUnpostedInRange`'dir.
   */
  findUnpostedInRange(
    params: UnpostedRangeParams,
    pagination: Pagination
  ): Promise<{ items: FinancialEvent[]; total: number }>;

  /**
   * Verilen aralıkta fişlenmemiş olayı **bulunan** defterlerin (klinik) listesi.
   * Zamanlanmış süpürme işi bunu kullanır: bütün klinikleri dolaşmak yerine
   * yalnız işi olanları hedefler. Skaler kimlik listesi döner (read-model değil).
   */
  findClinicsWithUnposted(params: UnpostedScanParams): Promise<string[]>;

  /**
   * Verilen kaynak referanslarından **olayı yazılmış** olanlar. Çağıran modül
   * (POS, fatura) kendi adaylarını üretir ve bu kümeyi çıkararak "köprüsü
   * kurulmamış" olanları bulur — satır başına ayrı sorgu atmak yerine tek sorgu.
   * Skaler kimlik listesi döner (read-model değil).
   */
  findExistingSourceRefIds(params: ExistingSourceRefParams): Promise<string[]>;
  /**
   * Verilen idempotency anahtarlarından yazılmış olanlar. `sourceRefId`
   * kümesinden ayrı durur çünkü **bir kaynak kayıt birden çok olaya** karşılık
   * gelebilir (rezervasyonda tahsilat + iade aynı `bookingPaymentId`'yi taşır);
   * referansa bakan sorgu o iki yönü ayırt edemez.
   */
  findExistingDedupeKeys(params: ExistingDedupeKeyParams): Promise<string[]>;
}

export interface ExistingSourceRefParams {
  clinicId: string;
  sourceModule: string;
  sourceRefIds: string[];
}

export interface ExistingDedupeKeyParams {
  clinicId: string;
  dedupeKeys: string[];
}
