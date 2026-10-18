import { QueryResponse } from '@shared/common/response/response.interface';

/** Fişlenmemiş olayı bulunan defterlerin (klinik) kimlikleri. */
export type GetClinicsWithUnpostedFinancialEventsResponse = QueryResponse<
  string[]
>;
