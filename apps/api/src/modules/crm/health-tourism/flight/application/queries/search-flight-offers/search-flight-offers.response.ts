import { QueryResponse } from '@shared/common/response/response.interface';
import { FlightOffer } from '@modules/crm/health-tourism/flight/domain/contracts';

export type SearchFlightOffersResponse = QueryResponse<FlightOffer[]>;
