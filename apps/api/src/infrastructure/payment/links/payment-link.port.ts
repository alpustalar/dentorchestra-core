import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Sağlayıcı-bağımsız "barındırılan ödeme linki" portu. iyzico (TRY, yurt içi) ve Stripe
 * (EUR/USD, yurt dışı) adapter'ları bunu implemente eder; sağlık turizmi tahsilat handler'ı
 * her booking için ilgili sağlayıcılardan link üretir. Doğrulama (webhook/callback) sağlayıcıya
 * özgüdür ve presentation katmanında yapılır — bu port yalnız link üretimi/iptali/iadesini soyutlar.
 */
export const IYZICO_PAYMENT_LINK = Symbol('IyzicoPaymentLinkAdapter');
export const STRIPE_PAYMENT_LINK = Symbol('StripePaymentLinkAdapter');

export type PaymentLinkProviderName = 'IYZICO' | 'STRIPE';

export interface PaymentLinkBuyer {
  name: string;
  surname: string;
  email: string;
  phone: string;
}

export interface CreatePaymentLinkInput {
  /** Mutabakat için metadata; webhook/callback bu id ile BookingPayment'ı bulur. */
  bookingPaymentId: string;
  amount: number;
  currency: CurrencyType;
  /** Sepet/satır kalemi açıklaması (ör. "Otel rezervasyonu — Hilton"). */
  description: string;
  buyer: PaymentLinkBuyer;
  /** Kullanıcı IP'si (iyzico zorunlu tutar). */
  ip: string;
}

export interface PaymentLinkResult {
  provider: PaymentLinkProviderName;
  /** iyzico: conversationId; Stripe: checkout session id. */
  sessionId: string;
  /** iyzico: retrieveCheckoutForm için token; Stripe: kullanılmaz. */
  token?: string;
  /** Hastaya gönderilecek ödeme sayfası URL'i. */
  url: string;
}

export interface RefundPaymentLinkInput {
  /** iyzico: paymentTransactionId; Stripe: payment_intent id. */
  providerRef: string;
  amount: number;
  currency: CurrencyType;
  ip?: string;
  reason?: string;
  /**
   * Sağlayıcıya iletilen tekrar-güvenli anahtar (`${refundId}:${attempt}`). iyzico'da
   * `conversationId` olur → operatör panelde bu anahtarla aratıp sonucu doğrulayabilir.
   */
  idempotencyKey: string;
}

/**
 * İade çağrısının üç durumlu sonucu (kural 18): oldu / olmadı / bilinmiyor.
 * Adaptör ham SDK sonucunu değil bu tipli sonucu döner; taşıma hatası (zaman aşımı,
 * bağlantı) fırlatılır ve çağıran onu `UNKNOWN` sayar.
 */
export type RefundPaymentLinkResult =
  | { outcome: 'SUCCEEDED'; providerRefundRef: string | null }
  | { outcome: 'REJECTED'; errorCode: string | null; errorMessage: string }
  | { outcome: 'UNKNOWN'; detail: string };

/** `EXPIRED`: sağlayıcıda geçersiz kılındı; `NOT_SUPPORTED`: sağlayıcıda böyle bir API yok. */
export type ExpirePaymentLinkResult = 'EXPIRED' | 'NOT_SUPPORTED';

export interface IPaymentLinkProvider {
  readonly provider: PaymentLinkProviderName;

  /** Barındırılan ödeme sayfası üretir. */
  createLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult>;

  /** Ödenmemiş linki geçersiz kılar (Stripe: session expire; iyzico: desteklenmez). */
  expireLink(sessionId: string): Promise<ExpirePaymentLinkResult>;

  /** Ödenmiş tutarın (tamamını/kısmını) iadesini yapar; sonucu tipli döner. */
  refund(input: RefundPaymentLinkInput): Promise<RefundPaymentLinkResult>;
}
