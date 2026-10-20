import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SyncHotelContentCommand } from './sync-hotel-content.command';
import {
  HOTELBEDS_API_SERVICE,
  IHotelbedsApiService,
} from '@modules/crm/health-tourism/hotel/domain/interfaces/hotelbeds-api.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  HOTELBEDS_HOTEL_COMMAND_REPOSITORY,
  IHotelbedsHotelCommandRepository,
} from '@modules/crm/health-tourism/hotel/domain/repositories/hotelbeds-hotel/hotelbeds-hotel.command.repository';

const COUNTRY_CODE = 'TR';
const BATCH_SIZE = 1000;

@CommandHandler(SyncHotelContentCommand)
export class SyncHotelContentHandler
  implements ICommandHandler<SyncHotelContentCommand, void>
{
  private readonly logger = new Logger(SyncHotelContentHandler.name);

  constructor(
    @Inject(HOTELBEDS_API_SERVICE)
    private readonly hotelbedsApi: IHotelbedsApiService,
    @Inject(HOTELBEDS_HOTEL_COMMAND_REPOSITORY)
    private readonly hotelbedsHotelRepo: IHotelbedsHotelCommandRepository
  ) {}

  async execute(): Promise<void> {
    this.logger.log('Hotelbeds Türkiye otel içerik senkronizasyonu başladı');

    let from = 1;
    let total = 0;
    let synced = 0;

    do {
      const to = from + BATCH_SIZE - 1;
      const result = await this.hotelbedsApi.getHotelContent({
        countryCode: COUNTRY_CODE,
        from,
        to,
      });

      if (total === 0) total = result.total;
      if (result.items.length === 0) break;

      const now = DateTimeManager.create();
      const upsertData = result.items.map((hotelContent) => ({
        id: String(hotelContent.code),
        name: hotelContent.name?.[0]?.content ?? String(hotelContent.code),
        categoryCode: hotelContent.category?.code ?? 'UNKNOWN',
        categoryName: hotelContent.category?.description?.[0]?.content,
        destinationCode: hotelContent.destinationCode,
        destinationName: hotelContent.destinationName?.[0]?.content,
        address: hotelContent.address?.content,
        latitude: hotelContent.coordinates?.latitude,
        longitude: hotelContent.coordinates?.longitude,
        images: hotelContent.images,
        phones: hotelContent.phones,
        lastSyncedAt: now,
      }));

      await this.hotelbedsHotelRepo.syncMany(upsertData);

      synced += result.items.length;
      from += BATCH_SIZE;
      this.logger.log(`Sync ilerleme: ${synced}/${total}`);
    } while (from <= total);

    this.logger.log(`Hotelbeds sync tamamlandı. Toplam: ${synced}`);
  }
}
