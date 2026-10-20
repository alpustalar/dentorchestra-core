import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@common/constants/env.constant';
import {
  CreatePaymentLinkInput,
  ExpirePaymentLinkResult,
  IPaymentLinkProvider,
  PaymentLinkProviderName,
  PaymentLinkResult,
  RefundPaymentLinkInput,
  RefundPaymentLinkResult,
} from '../payment-link.port';
import { StripeClientFactory } from './stripe-client.factory';

/**
 * Stripe Checkout Session tabanlı ödeme linki (yurt dışı müşteri — EUR/USD). Dinamik tutar +
 * metadata{bookingPaymentId} ile barındırılan sayfa üretir; ödeme `checkout.session.completed`
 * webhook'u ile doğrulanır (StripeWebhookController). Tutarlar Stripe'a minor birimde (kuruş/cent)
 * gönderilir. Session geçerlilik penceresi 30 dk (Stripe minimumu).
 */
@Injectable()
export class StripePaymentLinkAdapter implements IPaymentLinkProvider {
  readonly provider: PaymentLinkProviderName = 'STRIPE';

  /** Stripe session geçerlilik süresi (sn) — minimum 30 dk. */
  private static readonly SESSION_TTL_SECONDS = 30 * 60;

  constructor(
    private readonly stripe: StripeClientFactory,
    private readonly config: ConfigService
  ) {}

  async createLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    const base = this.resultBaseUrl();
    const session = await this.stripe.get().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: this.toMinor(input.amount),
            product_data: { name: input.description },
          },
        },
      ],
      customer_email: input.buyer.email || undefined,
      metadata: { bookingPaymentId: input.bookingPaymentId },
      payment_intent_data: {
        metadata: { bookingPaymentId: input.bookingPaymentId },
      },
      expires_at:
        Math.floor(Date.now() / 1000) +
        StripePaymentLinkAdapter.SESSION_TTL_SECONDS,
      success_url: `${base}?status=success&bp=${input.bookingPaymentId}`,
      cancel_url: `${base}?status=cancel&bp=${input.bookingPaymentId}`,
    });

    if (!session.url) {
      throw new Error('Stripe ödeme oturumu URL üretmedi.');
    }

    return { provider: this.provider, sessionId: session.id, url: session.url };
  }

  async expireLink(sessionId: string): Promise<ExpirePaymentLinkResult> {
    await this.stripe.get().checkout.sessions.expire(sessionId);
    return 'EXPIRED';
  }

  async refund(
    input: RefundPaymentLinkInput
  ): Promise<RefundPaymentLinkResult> {
    const refund = await this.stripe.get().refunds.create(
      {
        payment_intent: input.providerRef,
        amount: this.toMinor(input.amount),
        reason: 'requested_by_customer',
      },
      { idempotencyKey: input.idempotencyKey }
    );

    switch (refund.status) {
      case 'succeeded':
        return { outcome: 'SUCCEEDED', providerRefundRef: refund.id };
      case 'failed':
      case 'canceled':
        return {
          outcome: 'REJECTED',
          errorCode: refund.failure_reason ?? null,
          errorMessage: `Stripe iadesi ${refund.status}.`,
        };
      default:
        // pending / requires_action: sonuç sonradan belli olur → doğrulanmamış.
        return {
          outcome: 'UNKNOWN',
          detail: `Stripe iade durumu: ${refund.status ?? 'bilinmiyor'} (${refund.id})`,
        };
    }
  }

  /** 2 ondalıklı para birimleri (EUR/USD/GBP/TRY) için minor birime çevirir. */
  private toMinor(amount: number): number {
    return Math.round(amount * 100);
  }

  /** Ödeme sonrası yönlendirme tabanı (bilgilendirme amaçlı; gerçek sayfa şart değil). */
  private resultBaseUrl(): string {
    const base =
      this.config.get<string>(ENV.PUBLIC_BASE_URL) ??
      this.config.get<string>(ENV.ORIGIN) ??
      'https://example.com';
    return `${base}/health-tourism/booking-payments/result`;
  }
}
