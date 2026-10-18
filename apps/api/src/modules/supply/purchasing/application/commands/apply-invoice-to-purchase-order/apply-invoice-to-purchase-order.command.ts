import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Bir alış faturasının siparişe eşleştirilmesi (matching). `finance/purchase-invoice`
 * modülünden CommandBus üzerinden çağrılır — sipariş bu modülün aggregate'idir,
 * dışarıdan repo'suna dokunulmaz.
 */
export class ApplyInvoiceToPurchaseOrderCommand implements ICommand {
  constructor(
    public readonly payload: {
      readonly orderId: string;
      readonly invoiceId: string;
      readonly clinicId: string;
      readonly supplierId: string;
      /**
       * Faturanın KDV dahil toplamı — **kuruş ölçeğinde ondalık string**
       * (ör. `'1234.56'`). `number` değildi: para çift hassasiyetli kayan
       * noktaya çevrilip modül sınırını öyle geçiyordu ve sipariş sayacı
       * (`Decimal(14,2)`) bu değerden besleniyordu. Kuruş ölçeğinde kayıp
       * oluşmuyordu ama sözleşme, defterin para taşıma kuralından (string)
       * sapıyordu — kural tek yerde tutulmazsa bir sonraki alan sessizce
       * `number` olur.
       */
      readonly grandTotal: string;
      readonly currency: CurrencyType;
      readonly ctx: IGetContext;
    }
  ) {}
}
