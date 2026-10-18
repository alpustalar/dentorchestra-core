import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetBatchQuantityDriftResponse } from './get-batch-quantity-drift.response';

/**
 * Parti miktarı ↔ hareket toplamı sapma raporu.
 *
 * `product_batches.quantity` türetilmiş bir alandır (doğruluk kaynağı
 * `stock_movements`). Envanter değerlemesi ve 150 mutabakatı bu alandan
 * beslendiği için sapma, defterde değil **kaynakta** oluşan bir hatadır ve
 * 150 mutabakatı onu "sebebi bilinmeyen fark" olarak gösterir.
 */
export class GetBatchQuantityDriftQuery implements IQuery {
  readonly __responseType!: GetBatchQuantityDriftResponse;

  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
