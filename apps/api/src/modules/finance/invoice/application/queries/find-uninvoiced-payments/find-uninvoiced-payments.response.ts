import { QueryResponse } from '@shared/common/response/response.interface';
import { UninvoicedPaymentRow } from '@modules/finance/invoice/domain/contracts/invoice';

export type FindUninvoicedPaymentsResponse = QueryResponse<
  UninvoicedPaymentRow[]
>;
