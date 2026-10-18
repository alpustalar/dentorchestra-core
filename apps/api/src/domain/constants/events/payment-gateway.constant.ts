export const PAYMENT_GATEWAY_EVENTS = {
  REGISTERED: 'payment-gateway.registered',
} as const;

export type PaymentGatewayEvent =
  (typeof PAYMENT_GATEWAY_EVENTS)[keyof typeof PAYMENT_GATEWAY_EVENTS];
