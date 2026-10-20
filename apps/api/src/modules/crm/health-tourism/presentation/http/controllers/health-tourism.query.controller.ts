import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  GetFlightBookingsDto,
  GetHotelBookingsDto,
  GetTransferBookingsDto,
  SearchFlightsDto,
  SearchHotelsDto,
  SearchTransferAvailabilityDto,
} from '@shared/modules/health-tourism/dto/queries';
import { SearchFlightOffersQuery } from '@modules/crm/health-tourism/flight/application/queries/search-flight-offers/search-flight-offers.query';
import { GetFlightBookingsQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-bookings/get-flight-bookings.query';
import { GetFlightBookingByIdQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-booking-by-id/get-flight-booking-by-id.query';
import { DuffelFlightBookingResponseDto } from '@modules/crm/health-tourism/flight/presentation/http/dto/duffel-flight-booking-response.dto';
import { SearchHotelsQuery } from '@modules/crm/health-tourism/hotel/application/queries/search-hotels/search-hotels.query';
import { GetHotelBookingsQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-bookings/get-hotel-bookings.query';
import { GetHotelBookingByIdQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-booking-by-id/get-hotel-booking-by-id.query';
import { SearchTransferAvailabilityQuery } from '@modules/crm/health-tourism/transfer/application/queries/search-transfer-availability/search-transfer-availability.query';
import { GetTransferBookingsQuery } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-bookings/get-transfer-bookings.query';
import { GetTransferBookingByIdQuery } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-booking-by-id/get-transfer-booking-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  DuffelFlightBooking,
  HotelbedsBooking,
  HotelbedsTransferBooking,
} from '@shared';
import { HotelbedsBookingResponseDto } from '@modules/crm/health-tourism/hotel/presentation/http/dto/hotelbeds-booking-response.dto';
import { HotelbedsTransferBookingResponseDto } from '@modules/crm/health-tourism/transfer/presentation/http/dto/hotelbeds-transfer-booking-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const {
  HOTELBEDSBOOKING,
  HOTELBEDSHOTEL,
  HOTELBEDSTRANSFERBOOKING,
  DUFFELFLIGHTBOOKING,
} = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class HealthTourismQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(HOTELBEDSHOTEL.read)
  @Get('health-tourism/hotels/search')
  searchHotels(@Query() dto: SearchHotelsDto, @GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new SearchHotelsQuery(dto, ctx));
  }

  @HasCapability(HOTELBEDSBOOKING.read)
  @Get('health-tourism/bookings')
  @Serialize<HotelbedsBooking, HotelbedsBookingResponseDto>(
    HotelbedsBookingResponseDto,
    { isArray: true }
  )
  getBookings(
    @Query() dto: GetHotelBookingsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetHotelBookingsQuery(dto, ctx));
  }

  @HasCapability(HOTELBEDSBOOKING.read)
  @Get('health-tourism/bookings/:bookingId')
  @Serialize<HotelbedsBooking, HotelbedsBookingResponseDto>(
    HotelbedsBookingResponseDto
  )
  getBookingById(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetHotelBookingByIdQuery(bookingId, ctx));
  }

  // Transfer Endpoints ───────────────────────────────────────────────────

  @HasCapability(HOTELBEDSTRANSFERBOOKING.read)
  @Get('health-tourism/transfers/availability')
  searchTransferAvailability(
    @Query() dto: SearchTransferAvailabilityDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new SearchTransferAvailabilityQuery(dto, ctx));
  }

  @HasCapability(HOTELBEDSTRANSFERBOOKING.read)
  @Get('health-tourism/transfers/bookings')
  @Serialize<HotelbedsTransferBooking, HotelbedsTransferBookingResponseDto>(
    HotelbedsTransferBookingResponseDto,
    { isArray: true }
  )
  getTransferBookings(
    @Query() dto: GetTransferBookingsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetTransferBookingsQuery(dto, ctx));
  }

  @HasCapability(HOTELBEDSTRANSFERBOOKING.read)
  @Get('health-tourism/transfers/bookings/:bookingId')
  @Serialize<HotelbedsTransferBooking, HotelbedsTransferBookingResponseDto>(
    HotelbedsTransferBookingResponseDto
  )
  getTransferBookingById(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetTransferBookingByIdQuery(bookingId, ctx)
    );
  }

  // Uçuş Endpoints (Duffel) ──────────────────────────────────────────────

  @HasCapability(DUFFELFLIGHTBOOKING.read)
  @Get('health-tourism/flights/search')
  searchFlights(
    @Query() dto: SearchFlightsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new SearchFlightOffersQuery(dto, ctx));
  }

  @HasCapability(DUFFELFLIGHTBOOKING.read)
  @Get('health-tourism/flights/bookings')
  @Serialize<DuffelFlightBooking, DuffelFlightBookingResponseDto>(
    DuffelFlightBookingResponseDto,
    { isArray: true }
  )
  getFlightBookings(
    @Query() dto: GetFlightBookingsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetFlightBookingsQuery(dto, ctx));
  }

  @HasCapability(DUFFELFLIGHTBOOKING.read)
  @Get('health-tourism/flights/bookings/:bookingId')
  @Serialize<DuffelFlightBooking, DuffelFlightBookingResponseDto>(
    DuffelFlightBookingResponseDto
  )
  getFlightBookingById(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetFlightBookingByIdQuery(bookingId, ctx));
  }
}
