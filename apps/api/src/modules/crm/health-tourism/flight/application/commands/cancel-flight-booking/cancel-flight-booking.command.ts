import { IGetContext } from '@common/decorators/get-context.decorator';
import { CancelFlightBooking } from '@shared/modules/health-tourism/types/commands';
import type { CancelFlightBookingResponse } from './cancel-flight-booking.response';

export class CancelFlightBookingCommand {
  readonly __responseType!: CancelFlightBookingResponse;

  constructor(
    public readonly data: CancelFlightBooking,
    public readonly ctx: IGetContext
  ) {}
}
