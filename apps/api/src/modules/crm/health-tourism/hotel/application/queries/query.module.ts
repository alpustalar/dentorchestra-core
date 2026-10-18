import { Module } from '@nestjs/common';
import { SearchHotelsHandler } from './search-hotels/search-hotels.handler';
import { GetHotelBookingsHandler } from './get-hotel-bookings/get-hotel-bookings.handler';
import { GetHotelBookingByIdHandler } from './get-hotel-booking-by-id/get-hotel-booking-by-id.handler';
import { GetHotelRateOptionHandler } from './get-hotel-rate-option/get-hotel-rate-option.handler';
import { HotelInfrastructureModule } from '@modules/crm/health-tourism/hotel/infrastructure/infrastructure.module';
import { QuoteOptionModule } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.module';

export const HOTEL_QUERY_HANDLERS = [
  SearchHotelsHandler,
  GetHotelBookingsHandler,
  GetHotelBookingByIdHandler,
  GetHotelRateOptionHandler,
];

@Module({
  imports: [HotelInfrastructureModule, QuoteOptionModule],
  providers: [...HOTEL_QUERY_HANDLERS],
  exports: [...HOTEL_QUERY_HANDLERS],
})
export class HotelQueryModule {}
