import { GetFlightOfferResponse } from './get-flight-offer.response';

/** Kısa optionId → cache'teki Duffel teklif bağlamı. Süresi dolduysa `data: null`. */
export class GetFlightOfferQuery {
  readonly __responseType!: GetFlightOfferResponse;

  constructor(public readonly optionId: string) {}
}
