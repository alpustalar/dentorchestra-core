import { QueryResponse } from '@shared/common/response/response.interface';
import { DuffelFlightBooking } from '@shared';

export type GetFlightBookingsResponse = QueryResponse<DuffelFlightBooking[]>;
