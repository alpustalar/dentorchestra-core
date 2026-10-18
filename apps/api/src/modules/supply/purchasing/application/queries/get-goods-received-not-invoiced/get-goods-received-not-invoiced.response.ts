import { QueryResponse } from '@shared/common/response/response.interface';
import { GoodsReceivedNotInvoicedReport } from '@modules/supply/purchasing/domain/rules/purchase-order-billing.rules';

export type GetGoodsReceivedNotInvoicedResponse =
  QueryResponse<GoodsReceivedNotInvoicedReport>;
