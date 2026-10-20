export const PAYMENT_EVENTS = {
  PAID: 'payment.paid',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
  /** Kart itirazı kaybedildi (ters ibraz) — `REFUNDED`'dan farklı: para geri ALINDI. */
  CHARGED_BACK: 'payment.charged-back',
  INITIATED: 'payment.initiated',
  CANCELLED: 'payment.cancelled',
} as const;

export type PaymentEvent = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];
