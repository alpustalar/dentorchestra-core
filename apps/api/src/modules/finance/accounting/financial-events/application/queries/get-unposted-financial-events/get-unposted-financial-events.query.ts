import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { Pagination } from '@shared';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { GetUnpostedFinancialEventsResponse } from './get-unposted-financial-events.response';

/**
 * Fişlenmemiş ekonomik olaylar (mutabakat): olay defteri ↔ yevmiye farkı.
 * Dönem kapanışı bu liste boşalmadan geçmez.
 */
export class GetUnpostedFinancialEventsQuery implements IQuery {
  readonly __responseType!: GetUnpostedFinancialEventsResponse;
  constructor(
    public readonly payload: {
      readonly filter: {
        readonly clinicId: string;
        readonly from: Date;
        readonly to: Date;
        /** Fiş üretimi beklenen olay tipleri (`POSTABLE_FINANCIAL_EVENT_TYPES`). */
        readonly types: readonly FinancialEventType[];
      };
      readonly pagination: Pagination;
      readonly ctx: IGetContext;
    }
  ) {}
}
