import { QueryResponse } from '@shared/common/response/response.interface';
import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';

export type GetFlightOfferResponse = QueryResponse<FlightOfferToken | null>;
