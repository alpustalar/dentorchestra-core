import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

/**
 * Eşleştirmeyi geri alır: fatura yanlış siparişe bağlanmışsa ya da fatura iptal
 * edilirse sipariş sayacından düşülür. `finance/purchase-invoice`'tan çağrılır.
 */
export class RevertInvoiceFromPurchaseOrderCommand implements ICommand {
  constructor(
    public readonly payload: {
      readonly orderId: string;
      readonly invoiceId: string;
      /** Geri alınacak KDV dahil toplam — kuruş ölçeğinde ondalık string. */
      readonly grandTotal: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
