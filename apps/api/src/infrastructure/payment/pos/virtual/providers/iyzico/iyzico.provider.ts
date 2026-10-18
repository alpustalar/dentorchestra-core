import { BadRequestException, Injectable } from '@nestjs/common';
import { IyzicoClient } from './iyzico.client';
import { getGlobalPrefix, ROUTE_PATHS } from '@common/constants';
import { ENV } from '@common/constants/env.constant';
import { ConfigService } from '@nestjs/config';
import Iyzipay from 'iyzipay';
import { IIyzicoProvider } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import type { PaymentInitializeRequest } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/payment-initialize.request';
import {
  RetrieveCheckoutFormBuyer,
  RetrieveCheckoutFormResult,
  RetrieveCheckoutFormSavedCard,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/retrieve-checkout-form.result';
import { CancelPaymentRequest } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/cancel-payment.request';
import type {
  CreateSubMerchantRequest,
  RetrieveSubMerchantRequest,
  SubMerchantResult,
  UpdateSubMerchantRequest,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/create-submerchant.request';
import type {
  ChargeWithSavedCardRequest,
  ChargeWithSavedCardResult,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/charge-with-saved-card.request';

const PLACEHOLDER_IDENTITY_NUMBER = '11111111111';

@Injectable()
export class IyzicoProvider implements IIyzicoProvider {
  public readonly name = IyzicoProvider.name;
  constructor(
    private readonly client: IyzicoClient,
    private readonly configService: ConfigService
  ) {}

  get callbackUrl(): string {
    const origin = this.configService.get(ENV.ORIGIN) as string;
    const prefix = getGlobalPrefix();

    return `${origin}/${prefix}/${ROUTE_PATHS.PAYMENTS.IYZICO.FULL_CALLBACK_PATH}`;
  }

  async paymentInitialize(request: PaymentInitializeRequest) {
    return this.client.createCheckoutForm({
      callbackUrl: this.callbackUrl,
      ...request,
    });
  }

  async refund(data: Iyzipay.RefundRequestData) {
    return this.client.refundPayment(data);
  }

  async retrieveCheckoutForm(
    token: string
  ): Promise<RetrieveCheckoutFormResult> {
    const sdkResult = await this.client.retrieveCheckoutForm({ token });

    return {
      isSuccess: sdkResult.paymentStatus.toUpperCase() === 'SUCCESS',
      paymentId: sdkResult.paymentId,
      paymentTransactionId: sdkResult.paymentItems?.[0]?.paymentTransactionId,
      errorCode: sdkResult.errorCode,
      errorMessage: sdkResult.errorMessage,
      // Bağ ve tutar kanıtı: ikisi de sağlayıcının yanıtında geliyordu ama
      // mapping'de düşüyordu (CLAUDE.md finans kuralı 9). Düşen alan hata
      // vermez, log üretmez — burada düşen şey callback'in KİMLİK kanıtıydı.
      conversationId: sdkResult.conversationId,
      price: this.readAmount(sdkResult.price),
      currency: sdkResult.currency,
      paidPrice: this.readAmount(sdkResult.paidPrice),
      savedCard: this.extractSavedCard(sdkResult),
      buyer: this.extractBuyer(sdkResult),
      rawResponse: sdkResult as unknown,
    };
  }

  /**
   * Kayıtlı kartla (cardUserKey + cardToken) non-3DS otomatik tahsilat — abonelik yenilemesi.
   * Müşteri etkileşimi gerektirmez; ilk ödemede saklanan kart üzerinden çeker.
   */
  async chargeWithSavedCard(
    request: ChargeWithSavedCardRequest
  ): Promise<ChargeWithSavedCardResult> {
    const address = {
      contactName: `${request.buyer.name} ${request.buyer.surname}`,
      city: request.buyer.city || 'Istanbul',
      country: 'Turkey',
      address: request.buyer.address || 'Turkiye',
    };

    const sdkResult = await this.client.createPayment({
      locale: 'TR',
      conversationId: request.conversationId,
      price: request.price,
      paidPrice: request.price,
      currency: request.currency as Iyzipay.PaymentRequestData['currency'],
      installments: 1,
      basketId: request.basketId,
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      paymentCard: {
        cardUserKey: request.savedCard.cardUserKey,
        cardToken: request.savedCard.cardToken,
      },
      buyer: {
        id: request.buyer.id,
        name: request.buyer.name,
        surname: request.buyer.surname,
        email: request.buyer.email,
        gsmNumber: request.buyer.gsmNumber,
        identityNumber: PLACEHOLDER_IDENTITY_NUMBER,
        registrationAddress: address.address,
        ip: request.buyer.ip,
        city: address.city,
        country: 'Turkey',
      },
      shippingAddress: address,
      billingAddress: address,
      basketItems: [
        {
          id: request.basketId,
          name: request.basketItemLabel,
          category1: 'Abonelik',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: request.price,
        },
      ],
    });

    return {
      isSuccess: sdkResult.status === 'success',
      paymentId: sdkResult.paymentId,
      errorCode: sdkResult.errorCode,
      errorMessage: sdkResult.errorMessage,
      rawResponse: sdkResult as unknown,
    };
  }

  getInstallmentInfo({
    locale = 'TR',
    conversationId,
    price,
    binNumber,
  }: Iyzipay.InstallmentInfoRequestData) {
    return this.client.retrieveInstallmentInfo({
      locale,
      conversationId,
      price,
      binNumber,
    });
  }

  cancelPayment({ conversationId, paymentId, ip }: CancelPaymentRequest) {
    return this.client.createCancelPayment({
      locale: 'TR',
      conversationId,
      paymentId,
      ip,
    });
  }

  async createSubMerchant(
    request: CreateSubMerchantRequest
  ): Promise<SubMerchantResult> {
    const result = (await this.client.createSubMerchant({
      locale: 'TR',
      currency: 'TRY',
      ...request,
    })) as { status?: string; errorMessage?: string; subMerchantKey?: string };

    if (result.status !== 'success' || !result.subMerchantKey) {
      throw new BadRequestException(
        result.errorMessage ?? 'Alt üye işyeri oluşturulamadı.'
      );
    }
    return { subMerchantKey: result.subMerchantKey };
  }

  /**
   * Alt üye işyerini dış kimlikten (clinicId) okur; yoksa `null` döner.
   * Kurtarma yolu: iyzico'da açılmış ama yerelde yazılamamış kaydın anahtarını
   * geri getirir (bkz. RetrieveSubMerchantRequest).
   */
  async retrieveSubMerchant(
    request: RetrieveSubMerchantRequest
  ): Promise<SubMerchantResult | null> {
    const result = (await this.client.retrieveSubMerchant({
      locale: 'TR',
      ...request,
    })) as { status?: string; subMerchantKey?: string };

    if (result.status !== 'success' || !result.subMerchantKey) return null;
    return { subMerchantKey: result.subMerchantKey };
  }

  async updateSubMerchant(request: UpdateSubMerchantRequest): Promise<void> {
    const result = (await this.client.updateSubMerchant({
      locale: 'TR',
      currency: 'TRY',
      ...request,
    })) as { status?: string; errorMessage?: string };

    if (result.status !== 'success') {
      throw new BadRequestException(
        result.errorMessage ?? 'Alt üye işyeri güncellenemedi.'
      );
    }
  }

  /**
   * Tutar alanları **string** taşınır: SDK `number | string` döndürüyor ve
   * sayıyı `Decimal`'e doğrudan vermek ikili gösterim artığı taşır (string
   * üzerinden geçmek zorunlu).
   */
  private readAmount(value: number | string | undefined): string | undefined {
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : String(value);
  }

  /** Checkout retrieve yanıtından kart saklama token'larını çıkarır (SDK tipinde cardUserKey yok). */
  private extractSavedCard(
    sdkResult: Iyzipay.CheckoutFormRetrieveResult
  ): RetrieveCheckoutFormSavedCard | undefined {
    const raw = sdkResult as unknown as {
      cardUserKey?: string;
      cardToken?: string;
      paymentCard?: {
        cardToken?: string;
        cardUserKey?: string;
        binNumber?: string;
        lastFourDigits?: string;
        cardAssociation?: string;
        cardFamily?: string;
      };
    };

    const cardUserKey = raw.cardUserKey ?? raw.paymentCard?.cardUserKey;
    const cardToken = raw.cardToken ?? raw.paymentCard?.cardToken;

    if (!cardUserKey || !cardToken) return undefined;

    return {
      cardUserKey,
      cardToken,
      binNumber: raw.paymentCard?.binNumber,
      lastFourDigits: raw.paymentCard?.lastFourDigits,
      cardAssociation: raw.paymentCard?.cardAssociation,
      cardFamily: raw.paymentCard?.cardFamily,
    };
  }

  /** Checkout retrieve yanıtından alıcı bilgisini çıkarır (yenileme snapshot'ı için). */
  private extractBuyer(
    sdkResult: Iyzipay.CheckoutFormRetrieveResult
  ): RetrieveCheckoutFormBuyer | undefined {
    const buyer = sdkResult.buyer;
    if (!buyer) return undefined;

    return {
      id: buyer.id,
      name: buyer.name,
      surname: buyer.surname,
      email: buyer.email,
      gsmNumber: buyer.gsmNumber,
      ip: buyer.ip,
      city: sdkResult.billingAddress?.city ?? buyer.city,
      address: sdkResult.billingAddress?.address ?? buyer.registrationAddress,
    };
  }
}
