import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';

/**
 * AI `search_flights` akışının ürettiği kısa optionId → Duffel teklif bağlamını
 * cache'e yazar. `book_flight` optionId ile geri çözer. Cross-module: AI executor
 * cache'e doğrudan değil, bu command üzerinden erişir.
 */
export class CacheFlightOfferCommand {
  readonly __responseType!: void;

  constructor(
    public readonly optionId: string,
    public readonly token: FlightOfferToken
  ) {}
}
