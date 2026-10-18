import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { CancelInvoice } from '@shared/modules/invoice/types/commands';

/**
 * Satış faturasını iptal eder (storno): belge CANCELLED damgalanır ve defterdeki
 * hasılat/KDV etkisi ters kayıtla götürülür — ikisi aynı transaction içinde.
 *
 * Yüksek etkili finansal işlem (CLAUDE.md finans kuralı 7): uçta `invoice.delete`
 * yetkisi ister ve kalıcı damga (kim/ne zaman/neden) bırakır.
 */
export class CancelInvoiceCommand implements ICommand {
  readonly __responseType!: void;

  constructor(
    public readonly payload: {
      readonly invoiceId: string;
      readonly data: CancelInvoice;
      readonly ctx: IGetContext;
    }
  ) {}
}
