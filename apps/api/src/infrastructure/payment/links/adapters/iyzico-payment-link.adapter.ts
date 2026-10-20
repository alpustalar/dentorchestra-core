import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getGlobalPrefix, ROUTE_PATHS } from '@common/constants';
import { ENV } from '@common/constants/env.constant';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { PaymentInitializeRequest } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/payment-initialize.request';
import { IyzicoResultGuard } from '@src/domain/value-objects/iyzico-result-guard.vo';
import {
  CreatePaymentLinkInput,
  ExpirePaymentLinkResult,
  IPaymentLinkProvider,
  PaymentLinkProviderName,
  PaymentLinkResult,
  RefundPaymentLinkInput,
  RefundPaymentLinkResult,
} from '../payment-link.port';

/**
 * iyzico CheckoutForm tabanlı ödeme linki (yurt içi müşteri — TRY). Mevcut IIyzicoProvider'ı
 * sarmalar ama callback'i sağlık-turizmi booking callback'ine yönlendirir (randevu callback'inden
 * ayrı). Tutar caller tarafından TRY'ye çevrilmiş gelir. Ödeme, callback → retrieveCheckoutForm
 * ile doğrulanır (BookingPaymentIyzicoController).
 */
@Injectable()
export class IyzicoPaymentLinkAdapter implements IPaymentLinkProvider {
  readonly provider: PaymentLinkProviderName = 'IYZICO';

  constructor(
    @Inject(IYZICO_PROVIDER)
    private readonly iyzico: IIyzicoProvider,
    private readonly config: ConfigService
  ) {}

  async createLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    // conversationId = bookingPaymentId → callback'te BookingPayment doğrudan bulunur.
    const conversationId = input.bookingPaymentId;

    const request: PaymentInitializeRequest = {
      locale: 'TR',
      conversationId,
      price: input.amount,
      paidPrice: input.amount,
      currency: 'TRY',
      paymentChannel: 'WEB',
      paymentGroup: 'PRODUCT',
      callbackUrl: this.bookingCallbackUrl(),
      buyer: {
        id: input.bookingPaymentId,
        name: input.buyer.name,
        surname: input.buyer.surname,
        gsmNumber: input.buyer.phone,
        email: input.buyer.email || 'no-reply@example.com',
        identityNumber: '11111111111',
        registrationAddress: 'Türkiye',
        ip: input.ip,
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: `${input.buyer.name} ${input.buyer.surname}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
      },
      billingAddress: {
        contactName: `${input.buyer.name} ${input.buyer.surname}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
      },
      basketItems: [
        {
          id: input.bookingPaymentId,
          name: input.description,
          category1: 'Sağlık Turizmi',
          itemType: 'VIRTUAL',
          price: input.amount,
        },
      ],
    };

    const result = await this.iyzico.paymentInitialize(request);
    // iyzico iş hatasında fırlatmaz (`status: 'failure'`); sonucu açıkça denetle.
    IyzicoResultGuard.create(result).isSuccess().orThrow();
    if (!result.paymentPageUrl) {
      throw new Error(
        result.errorMessage ?? 'iyzico ödeme sayfası URL üretmedi.'
      );
    }

    return {
      provider: this.provider,
      sessionId: conversationId,
      token: result.token,
      url: result.paymentPageUrl,
    };
  }

  /** iyzico CheckoutForm'un explicit expire API'si yok; ödenmezse kullanılmaz. */
  async expireLink(): Promise<ExpirePaymentLinkResult> {
    return 'NOT_SUPPORTED';
  }

  /**
   * iyzico iade başarısızlığında **fırlatmaz**, `status: 'failure'` ile çözülür. Sonuç
   * okunmazsa para dönmemişken "iade tamamlandı" denir ve ters fiş atılır (P0-1).
   */
  async refund(
    input: RefundPaymentLinkInput
  ): Promise<RefundPaymentLinkResult> {
    const result = await this.iyzico.refund({
      locale: 'TR',
      conversationId: input.idempotencyKey,
      paymentTransactionId: input.providerRef,
      price: String(input.amount),
      ip: input.ip ?? '127.0.0.1',
      currency: 'TRY',
    });

    if (IyzicoResultGuard.create(result).isSuccess().isValid) {
      return {
        outcome: 'SUCCEEDED',
        providerRefundRef: result.hostReference ?? null,
      };
    }
    return {
      outcome: 'REJECTED',
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? 'iyzico iadeyi reddetti.',
    };
  }

  private bookingCallbackUrl(): string {
    const origin = this.config.get<string>(ENV.ORIGIN) ?? '';
    const prefix = getGlobalPrefix();
    return `${origin}/${prefix}/${ROUTE_PATHS.BOOKING_PAYMENTS.IYZICO_FULL_CALLBACK_PATH}`;
  }
}
