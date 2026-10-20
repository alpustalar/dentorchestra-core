import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IyzicoModule } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/iyzico.module';
import { IYZICO_PAYMENT_LINK, STRIPE_PAYMENT_LINK } from './payment-link.port';
import {
  PAYMENT_LINK_CHANNELS,
  paymentLinkChannelsFactory,
} from './payment-link-channels';
import { FX_RATE_PROVIDER } from './fx-rate.port';
import { SERVICE_FEE_PROVIDER } from './service-fee.port';
import { IyzicoPaymentLinkAdapter } from './adapters/iyzico-payment-link.adapter';
import { StripePaymentLinkAdapter } from './adapters/stripe-payment-link.adapter';
import { StripeClientFactory } from './adapters/stripe-client.factory';
import { StaticEnvFxRateProvider } from './adapters/static-env-fx-rate.provider';
import { StaticEnvServiceFeeProvider } from './adapters/static-env-service-fee.provider';
import { TcmbFxRateProvider } from './adapters/tcmb-fx-rate.provider';

/**
 * Sağlayıcı-bağımsız ödeme linki altyapısı: iyzico (TRY) + Stripe (EUR/USD) adapter'ları,
 * FX kuru ve Stripe istemci factory'si. Sağlık turizmi tahsilat (booking-payment) modülü
 * token'lar üzerinden tüketir; webhook controller'ı StripeClientFactory'yi imza doğrulama için kullanır.
 */
@Module({
  imports: [IyzicoModule],
  providers: [
    StripeClientFactory,
    // Hangi kanalların link ÜRETECEĞİ (Stripe varsayılan kapalı; açılış duyurulur).
    {
      provide: PAYMENT_LINK_CHANNELS,
      useFactory: paymentLinkChannelsFactory,
      inject: [ConfigService],
    },
    { provide: IYZICO_PAYMENT_LINK, useClass: IyzicoPaymentLinkAdapter },
    { provide: STRIPE_PAYMENT_LINK, useClass: StripePaymentLinkAdapter },
    // TCMB işlem-tarihli kur (statutory); çözülemezse StaticEnv fallback'e düşer.
    StaticEnvFxRateProvider,
    { provide: FX_RATE_PROVIDER, useClass: TcmbFxRateProvider },
    // Platform satış komisyonu oranı (env) — sağlık turizmi geliri.
    { provide: SERVICE_FEE_PROVIDER, useClass: StaticEnvServiceFeeProvider },
  ],
  exports: [
    StripeClientFactory,
    PAYMENT_LINK_CHANNELS,
    IYZICO_PAYMENT_LINK,
    STRIPE_PAYMENT_LINK,
    FX_RATE_PROVIDER,
    SERVICE_FEE_PROVIDER,
  ],
})
export class PaymentLinkModule {}
