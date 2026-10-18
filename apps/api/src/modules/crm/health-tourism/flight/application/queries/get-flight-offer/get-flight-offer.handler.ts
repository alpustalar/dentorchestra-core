import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetFlightOfferQuery } from './get-flight-offer.query';
import { GetFlightOfferResponse } from './get-flight-offer.response';
import {
  FLIGHT_CACHE_SERVICE,
  IFlightCacheService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/flight-cache.service.interface';
import {
  IQuoteOptionOwnershipService,
  QUOTE_OPTION_OWNERSHIP_SERVICE,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service.interface';

@QueryHandler(GetFlightOfferQuery)
export class GetFlightOfferHandler implements IQueryHandler<
  GetFlightOfferQuery,
  GetFlightOfferResponse
> {
  constructor(
    @Inject(FLIGHT_CACHE_SERVICE)
    private readonly cacheService: IFlightCacheService,
    @Inject(QUOTE_OPTION_OWNERSHIP_SERVICE)
    private readonly ownership: IQuoteOptionOwnershipService
  ) {}

  async execute(query: GetFlightOfferQuery): Promise<GetFlightOfferResponse> {
    const token = await this.cacheService.flightOffer.get(
      query.claim.clinicId,
      query.optionId
    );
    if (!token) return { data: null };

    this.ownership.assertOwned({
      kind: 'FLIGHT',
      optionId: query.optionId,
      stored: token.owner,
      claimed: query.claim,
    });

    return { data: token };
  }
}
