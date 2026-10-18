import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindExistingFinancialEventRefsResponse } from './find-existing-financial-event-refs.response';

/**
 * Verilen kaynak referanslarından ekonomik olayı **yazılmış** olanlar.
 *
 * Çağıran modül (POS, fatura) kendi adaylarını üretir, bu kümeyi çıkarır ve
 * "köprüsü kurulmamış" olanları bulur. Bounded context korunur: çağıran
 * `financial_events` tablosuna bakmaz, bu sorguyu kullanır.
 */
export class FindExistingFinancialEventRefsQuery implements IQuery {
  readonly __responseType!: FindExistingFinancialEventRefsResponse;

  constructor(
    public readonly payload: {
      readonly filter: {
        readonly clinicId: string;
        readonly sourceModule: string;
        readonly sourceRefIds: string[];
      };
      readonly ctx: IGetContext;
    }
  ) {}
}
