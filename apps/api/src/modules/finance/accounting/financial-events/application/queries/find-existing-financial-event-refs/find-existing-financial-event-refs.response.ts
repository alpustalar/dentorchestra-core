import { QueryResponse } from '@shared/common/response/response.interface';

/** Olayı zaten yazılmış kaynak referansları (skaler kimlikler). */
export type FindExistingFinancialEventRefsResponse = QueryResponse<string[]>;
