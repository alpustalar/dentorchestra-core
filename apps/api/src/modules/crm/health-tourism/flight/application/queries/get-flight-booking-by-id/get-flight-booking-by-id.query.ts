import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetFlightBookingByIdResponse } from './get-flight-booking-by-id.response';

export class GetFlightBookingByIdQuery {
  readonly __responseType!: GetFlightBookingByIdResponse;

  constructor(
    public readonly bookingId: string,
    public readonly ctx: IGetContext
  ) {}
}
