import { getGlobalPrefix } from '@common/constants';
import { ENV } from '@common/constants/env.constant';
import { ROUTE_PATHS } from '@common/constants/routes.constant';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { RetrieveCheckoutFormResult } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/retrieve-checkout-form.result';
import { randomUUID } from 'crypto';
import {
  CapturedSavedCard,
  ChargeSavedCardInput,
  IBillingAdapter,
  InitSubscriptionPaymentInput,
  PaymentResult,
} from './billing-adapter.interface';

const PLACEHOLDER_IDENTITY_NUMBER = '11111111111';

@Injectable()
export class IyzicoBillingAdapter implements IBillingAdapter {
  constructor(
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    private readonly configService: ConfigService
  ) {}

  async initializePayment(
    input: InitSubscriptionPaymentInput
  ): Promise<{ checkoutUrl: string; conversationId: string }> {
    const conversationId = randomUUID();

    const formattedPrice = input.amount.toApiFormat();

    const address = {
      contactName: `${input.buyer.name} ${input.buyer.surname}`,
      city: input.buyer.city || 'Istanbul',
      country: 'Turkey',
      address: input.buyer.address || 'Turkiye',
    };

    const result = await this.iyzicoProvider.paymentInitialize({
      locale: 'TR',
      conversationId,
      price: formattedPrice,
      paidPrice: formattedPrice,
      currency: input.amount.currency,
      basketId: input.organizationId,
      paymentGroup: 'PRODUCT',
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: input.buyer.id,
        name: input.buyer.name,
        surname: input.buyer.surname,
        email: input.buyer.email,
        gsmNumber: input.buyer.gsmNumber,
        identityNumber: PLACEHOLDER_IDENTITY_NUMBER,
        registrationAddress: address.address,
        ip: input.buyer.ip,
        city: address.city,
        country: 'Turkey',
      },
      shippingAddress: address,
      billingAddress: address,
      basketItems: [
        {
          id: input.organizationId,
          name: input.label,
          category1: 'Abonelik',
          itemType: 'VIRTUAL',
          price: formattedPrice,
        },
      ],
    });

    return {
      checkoutUrl: result.paymentPageUrl!,
      conversationId,
    };
  }

  async handlePaymentResult(token: string): Promise<PaymentResult> {
    const result = await this.iyzicoProvider.retrieveCheckoutForm(token);

    return {
      success: result.isSuccess,
      iyzicoPaymentId: result.paymentId,
      errorMessage: result.errorMessage,
      paidAmount: result.paidPrice,
      // Bağ kanıtı: gövdeden değil sağlayıcının yanıtından gelir.
      conversationId: result.conversationId,
      savedCard: this.mapSavedCard(result),
    };
  }

  async chargeSavedCard(input: ChargeSavedCardInput): Promise<PaymentResult> {
    const result = await this.iyzicoProvider.chargeWithSavedCard({
      conversationId: randomUUID(),
      price: input.amount.toApiFormat(),
      currency: input.amount.currency,
      basketId: input.organizationId,
      basketItemLabel: input.label,
      savedCard: input.savedCard,
      buyer: {
        id: input.buyer.id,
        name: input.buyer.name,
        surname: input.buyer.surname,
        email: input.buyer.email,
        gsmNumber: input.buyer.gsmNumber,
        ip: input.buyer.ip,
        city: input.buyer.city,
        address: input.buyer.address,
      },
    });

    return {
      success: result.isSuccess,
      iyzicoPaymentId: result.paymentId,
      errorMessage: result.errorMessage,
    };
  }

  async cancelPayment(iyzicoPaymentId: string, ip: string): Promise<void> {
    await this.iyzicoProvider.cancelPayment({
      conversationId: randomUUID(),
      paymentId: iyzicoPaymentId,
      ip,
    });
  }

  /** Checkout retrieve sonucundan kart saklama token'larını + alıcı snapshot'ını çıkarır. */
  private mapSavedCard(
    result: RetrieveCheckoutFormResult
  ): CapturedSavedCard | undefined {
    const { savedCard, buyer } = result;
    // Yenileme için hem token'lar hem de payment.create'i besleyecek alıcı bilgisi şart.
    if (!savedCard || !buyer?.name || !buyer.surname || !buyer.email) {
      return undefined;
    }

    const maskedNumber =
      savedCard.binNumber && savedCard.lastFourDigits
        ? `${savedCard.binNumber}******${savedCard.lastFourDigits}`
        : undefined;

    return {
      cardUserKey: savedCard.cardUserKey,
      cardToken: savedCard.cardToken,
      maskedNumber,
      cardAssociation: savedCard.cardAssociation,
      cardFamily: savedCard.cardFamily,
      buyer: {
        id: buyer.id ?? result.paymentId,
        name: buyer.name,
        surname: buyer.surname,
        email: buyer.email,
        gsmNumber: buyer.gsmNumber ?? '',
        ip: buyer.ip ?? '85.34.78.112',
        city: buyer.city,
        address: buyer.address,
      },
    };
  }

  private buildCallbackUrl(): string {
    const origin = this.configService.get<string>(ENV.ORIGIN)!;
    const prefix = getGlobalPrefix();
    return `${origin}/${prefix}/${ROUTE_PATHS.SUBSCRIPTIONS.FULL_CALLBACK_PATH}`;
  }
}
