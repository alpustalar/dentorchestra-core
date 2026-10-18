import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';

export const FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE = Symbol(
  'IFinancialEventPostingCompletenessService'
);

export interface AssertAllPostedInRangeParams {
  clinicId: string;
  from: Date;
  to: Date;
  /**
   * Yalnız bu tiplerdeki olaylar sayılır: fiş üretimi beklenen (posting kuralı
   * olan) tipler. Kuralı olmayan bir tip kapsama girerse mali yıl kapanışı
   * sonsuza kadar bloke olurdu — kapsam bu yüzden çağırandan açıkça gelir
   * (`POSTABLE_FINANCIAL_EVENT_TYPES`).
   */
  types: readonly FinancialEventType[];
}

/**
 * Dönem kapanışının ön koşulu (doc 04 §5 adım 1: "tüm bekleyen olayların fişe
 * dönüştüğünü doğrula").
 *
 * Neden domain servisi (bus değil): veri döndürmez, çağıranın **yazmasını kapıda
 * durdurur** — CLAUDE.md'deki senkron invariant kontrolü satırı. Okuma Command
 * Repo'dan yapılır: bu bir yazma kararını (dönemi kapatmak) besliyor ve replica
 * gecikmesiyle "hepsi fişlendi" görülürse dönem, fişsiz olaylar varken kapanır;
 * o olaylar bir daha fişlenemez (dönem kapısı reddeder) ve mizan kalıcı eksik kalır.
 */
export interface IFinancialEventPostingCompletenessService {
  assertAllPostedInRange(params: AssertAllPostedInRangeParams): Promise<void>;
}
