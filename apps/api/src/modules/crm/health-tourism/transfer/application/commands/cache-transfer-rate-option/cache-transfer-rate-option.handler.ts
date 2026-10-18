import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CacheTransferRateOptionCommand } from './cache-transfer-rate-option.command';
import {
  ITransferCacheService,
  TRANSFER_CACHE_SERVICE,
} from '@modules/crm/health-tourism/transfer/domain/interfaces/transfer-cache.service.interface';

@CommandHandler(CacheTransferRateOptionCommand)
export class CacheTransferRateOptionHandler implements ICommandHandler<
  CacheTransferRateOptionCommand,
  void
> {
  constructor(
    @Inject(TRANSFER_CACHE_SERVICE)
    private readonly cacheService: ITransferCacheService
  ) {}

  async execute(command: CacheTransferRateOptionCommand): Promise<void> {
    await this.cacheService.transferRateOption.set(
      command.optionId,
      command.token
    );
  }
}
