import { ICommand } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { IGetContext } from '@common/decorators';
import { ChargeBackInstallmentResponse } from './charge-back-installment.response';

/**
 * Kaybedilen kart itirazını ödeme planına yansıtır: taksit `CHARGED_BACK` olur ve
 * aynı tutarda bir telafi taksidi açılır.
 *
 * `installmentId` bilinen kaynakta (sanal POS) verilir; fiziksel POS satışı bir
 * plana bağlıdır ama hangi taksidi ödediği bilinmez — o zaman `amount` ile
 * **birebir tutar eşleşmesi** aranır (`PosPaymentSyncService` ile aynı kural).
 */
export class ChargeBackInstallmentCommand implements ICommand {
  readonly __responseType!: ChargeBackInstallmentResponse;
  constructor(
    public readonly payload: {
      readonly paymentId: string;
      /** Verilmezse `amount` ile tamamlanmış taksitler arasından eşleştirilir. */
      readonly installmentId?: string;
      readonly clinicId: string;
      /** İtiraz edilen tutar — taksit tutarına birebir eşit olmak zorundadır. */
      readonly amount: Decimal;
      /** Sağlayıcının vaka numarası — telafi taksidinin notunda iz olarak kalır. */
      readonly caseReference: string;
      /** Telafi taksidinin vadesi — itirazın kesinleştiği gün. */
      readonly dueDate: Date;
      readonly ctx: IGetContext;
    }
  ) {}
}
