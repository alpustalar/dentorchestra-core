import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { CancelPurchaseInvoice } from '@shared/modules/purchase-invoice/types/commands';

/**
 * Alış faturasını iptal eder (storno): belge CANCELLED damgalanır, defterdeki
 * 320 borcu + gider/stok etkisi ters kayıtla götürülür ve bağlı siparişin
 * faturalanmış tutar sayacı düşülür — hepsi aynı transaction içinde.
 *
 * Yüksek etkili finansal işlem (CLAUDE.md finans kuralı 7): uçta
 * `purchaseinvoice.delete` yetkisi ister ve kalıcı damga bırakır.
 */
export class CancelPurchaseInvoiceCommand implements ICommand {
  readonly __responseType!: void;

  constructor(
    public readonly payload: {
      readonly invoiceId: string;
      readonly data: CancelPurchaseInvoice;
      readonly ctx: IGetContext;
    }
  ) {}
}
