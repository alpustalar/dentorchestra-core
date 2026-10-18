import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { GetUnbridgedBookingLedgerEntries } from '@shared/modules/health-tourism/types/queries';
import { FindUnbridgedBookingLedgerEntriesResponse } from './find-unbridged-booking-ledger-entries.response';

export class FindUnbridgedBookingLedgerEntriesQuery implements IQuery {
  readonly __responseType!: FindUnbridgedBookingLedgerEntriesResponse;

  constructor(
    public readonly payload: {
      readonly filter: GetUnbridgedBookingLedgerEntries;
      readonly ctx: IGetContext;
    }
  ) {}
}
