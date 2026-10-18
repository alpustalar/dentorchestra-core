import { Inject, Injectable } from '@nestjs/common';
import {
  FINANCIAL_EVENT_COMMAND_REPOSITORY,
  IFinancialEventCommandRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import {
  AssertAllPostedInRangeParams,
  IFinancialEventPostingCompletenessService,
} from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service.interface';
import { UnpostedFinancialEventsException } from '@modules/finance/accounting/financial-events/domain/exceptions';

@Injectable()
export class FinancialEventPostingCompletenessService implements IFinancialEventPostingCompletenessService {
  constructor(
    @Inject(FINANCIAL_EVENT_COMMAND_REPOSITORY)
    private readonly financialEventCommandRepo: IFinancialEventCommandRepository
  ) {}

  async assertAllPostedInRange(
    params: AssertAllPostedInRangeParams
  ): Promise<void> {
    const unposted =
      await this.financialEventCommandRepo.countUnpostedInRange(params);

    if (unposted > 0) {
      throw new UnpostedFinancialEventsException({
        clinicId: params.clinicId,
        unpostedCount: unposted,
        from: params.from.toISOString(),
        to: params.to.toISOString(),
      });
    }
  }
}
