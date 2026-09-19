import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetFlightOfferQuery } from './get-flight-offer.query';
import { GetFlightOfferResponse } from './get-flight-offer.response';
import {
  FLIGHT_CACHE_SERVICE,
  IFlightCacheService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/flight-cache.service.interface';

@QueryHandler(GetFlightOfferQuery)
export class GetFlightOfferHandler implements IQueryHandler<
  GetFlightOfferQuery,
  GetFlightOfferResponse
> {
  constructor(
    @Inject(FLIGHT_CACHE_SERVICE)
    private readonly cacheService: IFlightCacheService
  ) {}

  async execute(query: GetFlightOfferQuery): Promise<GetFlightOfferResponse> {
    const token = await this.cacheService.flightOffer.get(query.optionId);
    return { data: token };
  }
}
