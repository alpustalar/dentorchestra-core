import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { GetClinicsWithUnpostedFinancialEventsResponse } from './get-clinics-with-unposted-financial-events.response';

/**
 * Hangi defterlerde fişlenmemiş ekonomik olay var? Zamanlanmış süpürme işi bunu
 * sorar ve yalnız işi olan kliniklere backfill çalıştırır.
 *
 * Kapsamı istekten gelen bir klinik yok: iş bütün defterleri tarar ve **sistem
 * aktörüyle** çağrılır (kullanıcıya açık bir uç değildir).
 */
export class GetClinicsWithUnpostedFinancialEventsQuery implements IQuery {
  readonly __responseType!: GetClinicsWithUnpostedFinancialEventsResponse;
  constructor(
    public readonly payload: {
      readonly filter: {
        readonly from: Date;
        readonly to: Date;
        /** Fiş üretimi beklenen olay tipleri (`POSTABLE_FINANCIAL_EVENT_TYPES`). */
        readonly types: readonly FinancialEventType[];
      };
      readonly ctx: IGetContext;
    }
  ) {}
}
