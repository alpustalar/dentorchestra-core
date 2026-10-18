import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindExistingFinancialEventDedupeKeysResponse } from './find-existing-financial-event-dedupe-keys.response';

/**
 * Verilen idempotency anahtarlarından ekonomik olayı **yazılmış** olanlar.
 *
 * Neden `sourceRefId` yerine `dedupeKey`: bir kaynak kayıt **birden çok** olaya
 * karşılık gelebilir. Rezervasyon ödemesinde aynı `bookingPaymentId` hem
 * tahsilat (`platform-booking-settled:<id>`) hem iade
 * (`platform-booking-refunded:<id>`) olayının kaynağıdır; referans kümesine
 * bakan sorgu (`FindExistingFinancialEventRefsQuery`) bu iki yönü **ayırt
 * edemez** ve tahsilatı yazılmış bir rezervasyonun eksik iade fişini
 * "köprülenmiş" sayardı. Anahtar yön başına ayrı olduğu için soru burada
 * doğru cevaplanır.
 *
 * Bounded context korunur: çağıran `financial_events` tablosuna bakmaz.
 */
export class FindExistingFinancialEventDedupeKeysQuery implements IQuery {
  readonly __responseType!: FindExistingFinancialEventDedupeKeysResponse;

  constructor(
    public readonly payload: {
      readonly filter: {
        readonly clinicId: string;
        readonly dedupeKeys: string[];
      };
      readonly ctx: IGetContext;
    }
  ) {}
}
