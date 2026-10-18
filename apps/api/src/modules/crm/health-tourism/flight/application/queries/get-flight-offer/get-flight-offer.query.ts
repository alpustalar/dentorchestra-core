import { GetFlightOfferResponse } from './get-flight-offer.response';
import { QuoteOptionClaim } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

/** Kısa optionId → cache'teki Duffel teklif bağlamı. Süresi dolduysa `data: null`. */
export class GetFlightOfferQuery {
  readonly __responseType!: GetFlightOfferResponse;

  /**
   * `claim`: teklifi kullanmak isteyen tarafın kapsamı (görüşme ya da yalnız
   * klinik). Teklif **bu kapsamla birlikte** okunur; kayıt başka bir
   * kiracıya/görüşmeye aitse sorgu `QuoteOptionRejectedException` fırlatır —
   * anahtarı bilmek yetki değildir.
   */
  constructor(
    public readonly optionId: string,
    public readonly claim: QuoteOptionClaim
  ) {}
}
