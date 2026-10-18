import { ICommand } from '@nestjs/cqrs';
import { HandlePaymentCallbackCommandResponse } from './handle-payment-callback.response';

export class HandlePaymentCallbackCommand implements ICommand {
  readonly __responseType!: HandlePaymentCallbackCommandResponse;

  constructor(
    public readonly token: string,
    public readonly conversationId: string,
    /**
     * iyzico'nun gönderdiği imza. **Doğrulanmıyor** ve bilinçli olarak
     * kullanılmıyor: ödeme sonucu gövdeden değil `retrieveCheckoutForm(token)`
     * ile iyzico'dan okunur, token ise kaydın kendi token'ıyla karşılaştırılır
     * (bkz. handler). Alan, sağlayıcının gönderdiği gövdeyi belgelemek ve
     * ileride imza doğrulaması eklenirse yer tutmak için duruyor.
     */
    public readonly signature: string
  ) {}
}
