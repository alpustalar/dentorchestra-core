import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CacheFlightOfferCommand } from './cache-flight-offer.command';
import {
  FLIGHT_CACHE_SERVICE,
  IFlightCacheService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/flight-cache.service.interface';

@CommandHandler(CacheFlightOfferCommand)
export class CacheFlightOfferHandler implements ICommandHandler<
  CacheFlightOfferCommand,
  void
> {
  constructor(
    @Inject(FLIGHT_CACHE_SERVICE)
    private readonly cacheService: IFlightCacheService
  ) {}

  async execute(command: CacheFlightOfferCommand): Promise<void> {
    await this.cacheService.flightOffer.set(command.optionId, command.token);
  }
}
