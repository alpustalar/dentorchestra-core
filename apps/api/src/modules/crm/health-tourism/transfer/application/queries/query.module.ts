import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SearchTransferAvailabilityHandler } from './search-transfer-availability/search-transfer-availability.handler';
import { GetTransferBookingsHandler } from './get-transfer-bookings/get-transfer-bookings.handler';
import { GetTransferBookingByIdHandler } from './get-transfer-booking-by-id/get-transfer-booking-by-id.handler';
import { HotelbedsTransferBookingRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/hotelbeds-transfer-booking/hotelbeds-transfer-booking.repository.module';
import { TransferCacheModule } from '@modules/crm/health-tourism/transfer/infrastructure/cache/transfer-cache.module';
import { GetTransferRateOptionHandler } from './get-transfer-rate-option/get-transfer-rate-option.handler';
import { HotelbedsTransferApiModule } from '@modules/crm/health-tourism/transfer/infrastructure/adapters/hotelbeds/hotelbeds-transfer-api.module';
import { QuoteOptionModule } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.module';

export const TRANSFER_QUERY_HANDLERS = [
  SearchTransferAvailabilityHandler,
  GetTransferBookingsHandler,
  GetTransferBookingByIdHandler,
  GetTransferRateOptionHandler,
];

@Module({
  imports: [
    CqrsModule,
    HotelbedsTransferApiModule,
    HotelbedsTransferBookingRepositoryModule,
    TransferCacheModule,
    QuoteOptionModule,
  ],
  providers: [...TRANSFER_QUERY_HANDLERS],
  exports: TRANSFER_QUERY_HANDLERS,
})
export class TransferQueryModule {}
