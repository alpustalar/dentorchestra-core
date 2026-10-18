import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTransferRateOptionQuery } from './get-transfer-rate-option.query';
import { GetTransferRateOptionResponse } from './get-transfer-rate-option.response';
import {
  ITransferCacheService,
  TRANSFER_CACHE_SERVICE,
} from '@modules/crm/health-tourism/transfer/domain/interfaces/transfer-cache.service.interface';
import {
  IQuoteOptionOwnershipService,
  QUOTE_OPTION_OWNERSHIP_SERVICE,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service.interface';

@QueryHandler(GetTransferRateOptionQuery)
export class GetTransferRateOptionHandler implements IQueryHandler<
  GetTransferRateOptionQuery,
  GetTransferRateOptionResponse
> {
  constructor(
    @Inject(TRANSFER_CACHE_SERVICE)
    private readonly cacheService: ITransferCacheService,
    @Inject(QUOTE_OPTION_OWNERSHIP_SERVICE)
    private readonly ownership: IQuoteOptionOwnershipService
  ) {}

  async execute(
    query: GetTransferRateOptionQuery
  ): Promise<GetTransferRateOptionResponse> {
    const token = await this.cacheService.transferRateOption.get(
      query.claim.clinicId,
      query.optionId
    );
    if (!token) return { data: null };

    this.ownership.assertOwned({
      kind: 'TRANSFER',
      optionId: query.optionId,
      stored: token.owner,
      claimed: query.claim,
    });

    return { data: token };
  }
}
