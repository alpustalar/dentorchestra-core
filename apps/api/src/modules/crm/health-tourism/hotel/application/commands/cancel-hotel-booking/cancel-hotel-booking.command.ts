import { CancelHotelBookingDto } from '@shared/modules/health-tourism/dto/commands';
import { IGetContext } from '@common/decorators/get-context.decorator';
import type { CancelHotelBookingResponse } from './cancel-hotel-booking.response';

export class CancelHotelBookingCommand {
  readonly __responseType!: CancelHotelBookingResponse;

  constructor(
    public readonly dto: CancelHotelBookingDto,
    public readonly ctx: IGetContext
  ) {}
}
