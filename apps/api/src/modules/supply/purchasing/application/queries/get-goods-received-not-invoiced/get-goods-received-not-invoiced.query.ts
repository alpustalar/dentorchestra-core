import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetGoodsReceivedNotInvoicedResponse } from './get-goods-received-not-invoiced.response';

/**
 * Mal kabul ↔ fatura mutabakatı (GRNI — goods received, not invoiced).
 *
 * Ay sonunun "malı gelmiş faturası gelmemiş alım var mı" sorusunu **hesaplanabilir**
 * bir kaleme çevirir: tek sipariş ekranındaki sapma (`GetPurchaseOrderMatchSummaryQuery`)
 * zaten vardı ama klinik seviyesinde toplanmıyordu — yani tahakkuk edilecek tutar
 * yalnız siparişleri tek tek gezerek bulunabiliyordu.
 */
export class GetGoodsReceivedNotInvoicedQuery implements IQuery {
  readonly __responseType!: GetGoodsReceivedNotInvoicedResponse;

  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
