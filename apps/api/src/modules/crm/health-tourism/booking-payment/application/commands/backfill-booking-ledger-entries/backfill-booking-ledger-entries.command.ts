import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { BackfillBookingLedgerEntries } from '@shared/modules/health-tourism/types/commands';
import { BackfillBookingLedgerEntriesResponse } from './backfill-booking-ledger-entries.response';

export class BackfillBookingLedgerEntriesCommand implements ICommand {
  readonly __responseType!: BackfillBookingLedgerEntriesResponse;

  constructor(
    public readonly payload: {
      readonly data: BackfillBookingLedgerEntries;
      readonly ctx: IGetContext;
    }
  ) {}
}
