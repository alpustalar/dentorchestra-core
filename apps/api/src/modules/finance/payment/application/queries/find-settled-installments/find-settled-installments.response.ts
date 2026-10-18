import { QueryResponse } from '@shared/common/response/response.interface';
import { SettledInstallmentRow } from '@modules/finance/payment/domain/contracts/payment';

export type FindSettledInstallmentsResponse = QueryResponse<
  SettledInstallmentRow[]
>;
