import { QueryResponse } from '@shared/common/response/response.interface';
import { CollectedPaymentRow } from '@modules/finance/payment/domain/contracts/payment';

export type FindCollectedPaymentsResponse = QueryResponse<
  CollectedPaymentRow[]
>;
