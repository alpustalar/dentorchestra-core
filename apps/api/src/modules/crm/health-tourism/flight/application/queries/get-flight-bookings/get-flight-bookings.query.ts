import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetFlightBookings } from '@shared/modules/health-tourism/types/queries';
import { GetFlightBookingsResponse } from './get-flight-bookings.response';

export class GetFlightBookingsQuery {
  readonly __responseType!: GetFlightBookingsResponse;

  constructor(
    public readonly filter: GetFlightBookings,
    public readonly ctx: IGetContext
  ) {}
}
