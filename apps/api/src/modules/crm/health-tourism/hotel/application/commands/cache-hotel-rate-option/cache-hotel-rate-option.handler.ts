import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CacheHotelRateOptionCommand } from './cache-hotel-rate-option.command';
import {
  HOTEL_CACHE_SERVICE,
  IHotelCacheService,
} from '@modules/crm/health-tourism/hotel/domain/interfaces/hotel-cache.service.interface';

@CommandHandler(CacheHotelRateOptionCommand)
export class CacheHotelRateOptionHandler implements ICommandHandler<
  CacheHotelRateOptionCommand,
  void
> {
  constructor(
    @Inject(HOTEL_CACHE_SERVICE)
    private readonly cacheService: IHotelCacheService
  ) {}

  async execute(command: CacheHotelRateOptionCommand): Promise<void> {
    await this.cacheService.hotelRateOption.set(
      command.optionId,
      command.token
    );
  }
}
