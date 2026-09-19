import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  BookFlightDto,
  BookHotelDto,
  BookTransferDto,
  CancelFlightBookingDto,
  CancelHotelBookingDto,
  CancelTransferBookingDto,
} from '@shared/modules/health-tourism/dto/commands';
import { BookFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/book-flight/book-flight.command';
import { CancelFlightBookingCommand } from '@modules/crm/health-tourism/flight/application/commands/cancel-flight-booking/cancel-flight-booking.command';
import { BookHotelCommand } from '@modules/crm/health-tourism/hotel/application/commands/book-hotel/book-hotel.command';
import { CancelHotelBookingCommand } from '@modules/crm/health-tourism/hotel/application/commands/cancel-hotel-booking/cancel-hotel-booking.command';
import { BookTransferCommand } from '@modules/crm/health-tourism/transfer/application/commands/book-transfer/book-transfer.command';
import { CancelTransferBookingCommand } from '@modules/crm/health-tourism/transfer/application/commands/cancel-transfer-booking/cancel-transfer-booking.command';
import { ManualBookingOverrideRequiredException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { HOTELBEDSBOOKING, HOTELBEDSTRANSFERBOOKING, DUFFELFLIGHTBOOKING } =
  CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class HealthTourismCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  // Direkt (ödeme-önce saga'yı baypas eden) booking. Varsayılan akış: AI/hasta
  // InitiateBookingPayment ile ödeme linki üretir, ödeme webhook'u rezervasyonu açar.
  // Bu endpoint yalnızca ödemenin kanal dışı tahsil edildiği MANUEL override içindir.
  @HasCapability(HOTELBEDSBOOKING.create)
  @Post('health-tourism/bookings')
  bookHotel(@Body() dto: BookHotelDto, @GetContext() ctx: IGetContext) {
    if (!dto.manualOverride) {
      throw new ManualBookingOverrideRequiredException();
    }
    return this.commandBus.execute(new BookHotelCommand(dto, ctx));
  }

  @HasCapability(HOTELBEDSBOOKING.delete)
  @Delete('health-tourism/bookings/:bookingId')
  cancelBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @GetContext() ctx: IGetContext
  ) {
    const dto = { bookingId } as CancelHotelBookingDto;
    return this.commandBus.execute(new CancelHotelBookingCommand(dto, ctx));
  }

  // Direkt (ödeme-önce saga'yı baypas eden) transfer booking — yalnızca manuel override.
  @HasCapability(HOTELBEDSTRANSFERBOOKING.create)
  @Post('health-tourism/transfers/bookings')
  bookTransfer(@Body() dto: BookTransferDto, @GetContext() ctx: IGetContext) {
    if (!dto.manualOverride) {
      throw new ManualBookingOverrideRequiredException();
    }
    return this.commandBus.execute(new BookTransferCommand(dto, ctx));
  }

  @HasCapability(HOTELBEDSTRANSFERBOOKING.delete)
  @Delete('health-tourism/transfers/bookings/:reference')
  cancelTransferBooking(
    @Param('reference') reference: string,
    @Body() dto: CancelTransferBookingDto,
    @GetContext() ctx: IGetContext
  ) {
    const cancelDto = { ...dto, reference } as CancelTransferBookingDto;
    return this.commandBus.execute(
      new CancelTransferBookingCommand(cancelDto, ctx)
    );
  }

  // Direkt (ödeme-önce saga'yı baypas eden) uçuş booking — yalnızca manuel override.
  // Bilet anında kesilir ve ödenir; normal akış AI/hasta tarafında ödeme linkidir.
  @HasCapability(DUFFELFLIGHTBOOKING.create)
  @Post('health-tourism/flights/bookings')
  bookFlight(@Body() dto: BookFlightDto, @GetContext() ctx: IGetContext) {
    if (!dto.manualOverride) {
      throw new ManualBookingOverrideRequiredException();
    }
    return this.commandBus.execute(new BookFlightCommand(dto, ctx));
  }

  @HasCapability(DUFFELFLIGHTBOOKING.delete)
  @Delete('health-tourism/flights/bookings/:bookingId')
  cancelFlightBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: CancelFlightBookingDto,
    @GetContext() ctx: IGetContext
  ) {
    const cancelDto = { ...dto, bookingId } as CancelFlightBookingDto;
    return this.commandBus.execute(
      new CancelFlightBookingCommand(cancelDto, ctx)
    );
  }
}
