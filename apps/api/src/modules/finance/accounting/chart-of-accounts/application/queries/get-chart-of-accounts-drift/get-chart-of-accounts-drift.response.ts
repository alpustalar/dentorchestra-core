import { QueryResponse } from '@shared/common/response/response.interface';
import { ChartDriftReport } from '@modules/finance/accounting/chart-of-accounts/domain/services/template-integrity';

export type GetChartOfAccountsDriftResponse = QueryResponse<ChartDriftReport>;
