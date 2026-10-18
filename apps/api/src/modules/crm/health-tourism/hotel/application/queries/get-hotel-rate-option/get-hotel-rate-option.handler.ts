import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetHotelRateOptionQuery } from './get-hotel-rate-option.query';
import { GetHotelRateOptionResponse } from './get-hotel-rate-option.response';
import {
  HOTEL_CACHE_SERVICE,
  IHotelCacheService,
} from '@modules/crm/health-tourism/hotel/domain/interfaces/hotel-cache.service.interface';
import {
  IQuoteOptionOwnershipService,
  QUOTE_OPTION_OWNERSHIP_SERVICE,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service.interface';

@QueryHandler(GetHotelRateOptionQuery)
export class GetHotelRateOptionHandler implements IQueryHandler<
  GetHotelRateOptionQuery,
  GetHotelRateOptionResponse
> {
  constructor(
    @Inject(HOTEL_CACHE_SERVICE)
    private readonly cacheService: IHotelCacheService,
    @Inject(QUOTE_OPTION_OWNERSHIP_SERVICE)
    private readonly ownership: IQuoteOptionOwnershipService
  ) {}

  async execute(
    query: GetHotelRateOptionQuery
  ): Promise<GetHotelRateOptionResponse> {
    const token = await this.cacheService.hotelRateOption.get(
      query.claim.clinicId,
      query.optionId
    );
    // Kayıt yoksa "süresi doldu" yolu: çağıran hastaya tekrar arama önerir.
    if (!token) return { data: null };

    // Kayıt var: **bu görüşmeye mi ait?** Anahtar bir adres, yetki değil.
    this.ownership.assertOwned({
      kind: 'HOTEL',
      optionId: query.optionId,
      stored: token.owner,
      claimed: query.claim,
    });

    return { data: token };
  }
}
