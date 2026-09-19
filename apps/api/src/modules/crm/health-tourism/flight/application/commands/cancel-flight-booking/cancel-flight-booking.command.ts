import { IGetContext } from '@common/decorators/get-context.decorator';
import { CancelFlightBooking } from '@shared/modules/health-tourism/types/commands';

export class CancelFlightBookingCommand {
  readonly __responseType!: void;

  constructor(
    public readonly data: CancelFlightBooking,
    public readonly ctx: IGetContext
  ) {}
}
