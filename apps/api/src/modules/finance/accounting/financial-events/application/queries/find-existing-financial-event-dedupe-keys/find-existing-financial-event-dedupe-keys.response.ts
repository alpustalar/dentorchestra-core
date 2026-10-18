import { QueryResponse } from '@shared/common/response/response.interface';

/** Verilen anahtarlardan defterde **zaten yazılmış** olanlar. */
export type FindExistingFinancialEventDedupeKeysResponse = QueryResponse<
  string[]
>;
