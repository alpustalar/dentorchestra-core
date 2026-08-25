import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchFlightOffersQuery } from './search-flight-offers.query';
import { SearchFlightOffersResponse } from './search-flight-offers.response';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';

@QueryHandler(SearchFlightOffersQuery)
export class SearchFlightOffersHandler implements IQueryHandler<
  SearchFlightOffersQuery,
  SearchFlightOffersResponse
> {
  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService
  ) {}

  async execute(
    query: SearchFlightOffersQuery
  ): Promise<SearchFlightOffersResponse> {
    const { filter } = query;

    // Teklifler cache'lenmez: uçuş fiyatı/koltuk durumu dakikalar içinde değişir ve
    // bayat bir listeden seçilen teklif rezervasyon anında zaten reddedilir.
    // Cache yalnız arama→rezervasyon arasındaki tekil teklif token'ında kullanılır.
    const offers = await this.duffelApi.searchOffers({
      originIata: filter.origin,
      destinationIata: filter.destination,
      departureDate: filter.departureDate,
      returnDate: filter.returnDate,
      adults: filter.adults,
      children: filter.children,
      infants: filter.infants,
      cabinClass: filter.cabinClass,
    });

    return { data: offers };
  }
}
