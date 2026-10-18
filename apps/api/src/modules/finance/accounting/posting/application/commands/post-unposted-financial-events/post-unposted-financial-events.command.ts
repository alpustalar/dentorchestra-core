import { IGetContext } from '@common/decorators';

/**
 * Fişlenmemiş ekonomik olayları (yeniden) fişler — **backfill**.
 *
 * Neden gerekli: `FinancialEventRecordedListener` posting hatasını bilerek yutar
 * (olay defteri bozulmasın diye) ve outbox kaydı işlenmiş sayılır — yani hata
 * geçici olsa bile (dönem henüz açılmamış, hesap planı eksik) olay kendi kendine
 * fişlenmez. CRITICAL uyarı bunu görünür kılar; bu komut düzeltme yolunu verir.
 */
export class PostUnpostedFinancialEventsCommand {
  readonly __responseType!: PostUnpostedFinancialEventsResult;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly from: Date;
      readonly to: Date;
      readonly ctx: IGetContext;
    }
  ) {}
}

export interface PostUnpostedFinancialEventsResult {
  /** Fişi üretilen olay sayısı. */
  posted: number;
  /** Posting kuralı olmadığı için atlanan olay sayısı. */
  skipped: number;
  /** Hata alan olay sayısı (ayrıntı log + CRITICAL uyarıda). */
  failed: number;
}
