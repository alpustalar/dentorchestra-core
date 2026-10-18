import { ChartOfAccountsInitializedEventPayload } from '@modules/finance/accounting/chart-of-accounts/domain/events';

export const CHART_OF_ACCOUNTS_EVENT_PUBLISHER = Symbol(
  'IChartOfAccountsEventPublisher'
);

export interface IChartOfAccountsEventPublisher {
  initialized(payload: ChartOfAccountsInitializedEventPayload): void;
}
