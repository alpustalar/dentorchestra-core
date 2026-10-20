import { QueryResponse } from '@shared/common/response/response.interface';
import { PurchaseInvoiceOrderAmount } from '@modules/finance/purchase-invoice/domain/contracts/purchase-invoice';

export type GetPurchaseInvoiceAmountsByOrderResponse = QueryResponse<
  PurchaseInvoiceOrderAmount[]
>;
