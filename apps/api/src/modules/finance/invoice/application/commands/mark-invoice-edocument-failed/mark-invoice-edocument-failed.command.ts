import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';

/**
 * e-Belge gönderimi başarısız oldu: `einvoiceStatus = FAILED` işaretlenir ve
 * `InvoiceFailedEvent` fırlatılır (audit izi + alarm).
 *
 * Faturanın kendi durumu DEĞİŞMEZ — hasılat/KDV zaten muhasebeleşmiştir
 * (doc 07 §5). FAILED, gönderim hakkının yeniden sahiplenilemeyeceği bir
 * durumdur: entegratörde belge oluşup oluşmadığı bilinmediği için otomatik
 * yeniden gönderim yapılmaz, çıkış bilinçli bir insan kararıdır.
 */
export class MarkInvoiceEDocumentFailedCommand implements ICommand {
  readonly __responseType!: void;
  constructor(
    public readonly payload: {
      readonly invoiceId: string;
      readonly reason: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
