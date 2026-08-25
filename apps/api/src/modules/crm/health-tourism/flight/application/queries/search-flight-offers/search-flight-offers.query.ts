import { IGetContext } from '@common/decorators/get-context.decorator';
import { SearchFlights } from '@shared/modules/health-tourism/types/queries';
import { SearchFlightOffersResponse } from './search-flight-offers.response';

export class SearchFlightOffersQuery {
  readonly __responseType!: SearchFlightOffersResponse;

  constructor(
    public readonly filter: SearchFlights,
    public readonly ctx: IGetContext
  ) {}
}
