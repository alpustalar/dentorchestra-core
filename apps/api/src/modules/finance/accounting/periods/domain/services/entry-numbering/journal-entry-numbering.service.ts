import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_PERIOD_COMMAND_REPOSITORY,
  IAccountingPeriodCommandRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import { IJournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';

/**
 * Sayaç Command Repository'den okunur/yazılır: bu çağrı bir yazmayı (fiş atma)
 * besliyor ve kilit gerektiriyor, dolayısıyla Command Context'e aittir.
 */
@Injectable()
export class JournalEntryNumberingService implements IJournalEntryNumberingService {
  constructor(
    @Inject(ACCOUNTING_PERIOD_COMMAND_REPOSITORY)
    private readonly periodCommandRepo: IAccountingPeriodCommandRepository
  ) {}

  lockAndAllocateEntryNo(periodId: string): Promise<bigint> {
    return this.periodCommandRepo.lockAndAllocateEntryNo(periodId);
  }

  lockAndAllocateClosingEntryNo(periodId: string): Promise<bigint> {
    return this.periodCommandRepo.lockAndAllocateClosingEntryNo(periodId);
  }
}
