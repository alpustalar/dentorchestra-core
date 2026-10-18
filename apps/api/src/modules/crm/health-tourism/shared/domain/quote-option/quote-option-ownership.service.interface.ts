export const QUOTE_OPTION_OWNERSHIP_SERVICE = Symbol(
  'IQuoteOptionOwnershipService'
);

import {
  QuoteOptionClaim,
  QuoteOptionKind,
  QuoteOptionOwner,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

export interface AssertQuoteOptionOwnedParams {
  readonly kind: QuoteOptionKind;
  readonly optionId: string;
  /** Önbellekteki kaydın sahibi (kayıt yoksa bu metot hiç çağrılmaz). */
  readonly stored: QuoteOptionOwner | null | undefined;
  /** Teklifi kullanmak isteyen tarafın kapsamı (görüşme ya da yalnız klinik). */
  readonly claimed: QuoteOptionClaim;
}

/**
 * Teklif sahipliği kapısı — üç dikeyin (otel/transfer/uçuş) **tek** kontrolü.
 *
 * Neden servis: kontrol üç yerde gerekiyor ve her birinde uyarı da üretilmeli.
 * Üç kopya, dördüncü dikey eklendiğinde dördüncü kopyayı davet eder (§73'ün
 * dersi: bir kontrol ikinci kez gerekiyorsa o bir kuraldır — kopyalanmaz,
 * taşınır). Sözleşme CLAUDE.md'nin domain-servis istisnasına uyar: yalnız
 * `assert*`, veri döndürmez, yazma yapmaz.
 */
export interface IQuoteOptionOwnershipService {
  /** Uyuşmazlıkta uyarı üretir ve `QuoteOptionRejectedException` fırlatır. */
  assertOwned(params: AssertQuoteOptionOwnedParams): void;
}
