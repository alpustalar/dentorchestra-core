import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@common/constants/env.constant';

export const PAYMENT_LINK_CHANNELS = Symbol('PaymentLinkChannels');

/** Hangi ödeme linki kanallarının ÜRETİLECEĞİ. Webhook / iade / expire yolları bundan bağımsızdır. */
export interface PaymentLinkChannels {
  readonly stripeEnabled: boolean;
}

/**
 * Stripe linkleri yalnız AÇIK bir bayrakla üretilir (`STRIPE_PAYMENT_LINKS_ENABLED=true`).
 *
 * Neden varsayılan kapalı: Stripe parası için kapanış akışı yok — payout (108 → 102), Stripe
 * ücreti, itiraz (`charge.dispute.*`) ve kur farkı deftere yazılmıyor. Yalnız anahtarın
 * tanımsız olması bir kapı değildir: biri `STRIPE_SECRET_KEY`'i koyduğu an para sessizce 108'e
 * girer ve orada kalır (kural 16: geçiş hesabı açan akış kapatanla birlikte tasarlanır).
 *
 * Seçim **sessiz yapılmaz** (kural 15a): açılışta duyurulur, üretimde `error` seviyesinde.
 * Modül dışında durur — yanlış dallanma testsiz fark edilmez.
 */
export const paymentLinkChannelsFactory = (
  config: ConfigService
): PaymentLinkChannels => {
  const logger = new Logger('PaymentLinkChannels');
  const production = config.get<string>(ENV.MODE) === 'PRODUCTION';
  const announce = (message: string) =>
    production ? logger.error(message) : logger.warn(message);

  const requested =
    config.get<string>(ENV.STRIPE_PAYMENT_LINKS_ENABLED) === 'true';

  if (!requested) {
    logger.log(
      `Stripe ödeme linkleri KAPALI (${ENV.STRIPE_PAYMENT_LINKS_ENABLED} 'true' değil): yabancı para satışlarında yalnız iyzico TRY linki üretilir.`
    );
    return { stripeEnabled: false };
  }

  const key = config.get<string>(ENV.STRIPE_SECRET_KEY);
  if (!key || key === 'none') {
    logger.error(
      `${ENV.STRIPE_PAYMENT_LINKS_ENABLED}=true ama ${ENV.STRIPE_SECRET_KEY} tanımsız ya da 'none': Stripe linkleri KAPALI sayılıyor.`
    );
    return { stripeEnabled: false };
  }

  announce(
    `Stripe ödeme linkleri AÇIK — Stripe parası için KAPANIŞ AKIŞI YOK (payout→102, Stripe ücreti, itiraz, kur farkı deftere yazılmıyor); tahsilat 108'de birikir (kural 16). Bkz. envs/.env.example.`
  );
  return { stripeEnabled: true };
};
