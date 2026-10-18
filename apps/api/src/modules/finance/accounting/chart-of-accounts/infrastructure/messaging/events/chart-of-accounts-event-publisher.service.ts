import { Inject, Injectable } from '@nestjs/common';
import {
  ChartOfAccountsInitializedEvent,
  ChartOfAccountsInitializedEventPayload,
} from '@modules/finance/accounting/chart-of-accounts/domain/events';
import { IChartOfAccountsEventPublisher } from '@modules/finance/accounting/chart-of-accounts/domain/interfaces/chart-of-accounts-event-publisher.interface';
import {
  CONTEXT_SERVICE,
  IContextService,
} from '@src/infrastructure/context/context.service.interface';

@Injectable()
export class ChartOfAccountsEventPublisher implements IChartOfAccountsEventPublisher {
  constructor(
    @Inject(CONTEXT_SERVICE)
    private readonly contextService: IContextService
  ) {}

  initialized(payload: ChartOfAccountsInitializedEventPayload): void {
    this.contextService.addEvent(new ChartOfAccountsInitializedEvent(payload));
  }
}
