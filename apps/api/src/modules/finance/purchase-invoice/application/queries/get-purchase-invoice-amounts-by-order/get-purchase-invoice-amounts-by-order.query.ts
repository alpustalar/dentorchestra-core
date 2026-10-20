import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetPurchaseInvoiceAmountsByOrderResponse } from './get-purchase-invoice-amounts-by-order.response';

/**
 * Siparişlere bağlı alış faturalarının tutarları, `asOf` itibarıyla.
 *
 * Satın alma modülünün GRNI hesabı (mal geldi, fatura gelmedi) faturaları DOĞRUDAN okuyamaz
 * (modüller arası tablo erişimi yasak) ve siparişin `invoicedTotal` sayacı tarihsizdir: o sayaç
 * "bugün ne kadar faturalandı"yı verir, "31 Aralık'ta ne kadar faturalıydı"yı vermez. Bu sorgu
 * fatura tarihlerinden ve iptal anından `asOf` fotoğrafını üretir.
 */
export class GetPurchaseInvoiceAmountsByOrderQuery implements IQuery {
  readonly __responseType!: GetPurchaseInvoiceAmountsByOrderResponse;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly orderIds: readonly string[];
      readonly asOf: Date;
      readonly ctx: IGetContext;
    }
  ) {}
}
