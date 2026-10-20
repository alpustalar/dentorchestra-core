const BASE_PATHS = {
  ORGANIZATIONS: 'organizations',
  CLINICS: 'clinics',
  USERS: 'users',
  POS: 'pos',
  PAYMENTS: 'payments',
  IYZICO: 'iyzico',
  CALLBACK: 'callback',
  SUBSCRIPTIONS: 'subscriptions',
  HEALTH_TOURISM: 'health-tourism',
  BOOKING_PAYMENTS: 'booking-payments',
  STRIPE: 'stripe',
  WEBHOOK: 'webhook',
} as const;

export const ROUTE_PATHS = {
  ORGANIZATIONS: BASE_PATHS.ORGANIZATIONS,
  CLINICS: BASE_PATHS.CLINICS,
  USERS: BASE_PATHS.USERS,
  PAYMENTS: {
    ROOT: BASE_PATHS.PAYMENTS,
    IYZICO: {
      ROOT: BASE_PATHS.IYZICO,
      CALLBACK: BASE_PATHS.CALLBACK,
      FULL_CALLBACK_PATH: `${BASE_PATHS.POS}/${BASE_PATHS.IYZICO}/${BASE_PATHS.CALLBACK}`,
    },
  },
  SUBSCRIPTIONS: {
    ROOT: BASE_PATHS.SUBSCRIPTIONS,
    CALLBACK: BASE_PATHS.CALLBACK,
    FULL_CALLBACK_PATH: `${BASE_PATHS.SUBSCRIPTIONS}/${BASE_PATHS.CALLBACK}`,
  },
  // Sağlık turizmi (otel/transfer) ödeme-önce tahsilatı — iyzico callback + Stripe webhook
  BOOKING_PAYMENTS: {
    // `*_ROOT` @Controller() içinde kullanılır ve modül ön ekine GÖREDİR:
    // RouterModule zaten `health-tourism` ön ekini ekliyor, burada tekrarlanırsa
    // yol /health-tourism/health-tourism/... olur ve sağlayıcı geri çağrısı 404 alır.
    // `*_FULL_*` ise mutlak yoldur; dışarıya verilen URL'i kurmakta kullanılır.
    ROOT: BASE_PATHS.BOOKING_PAYMENTS,
    IYZICO_ROOT: `${BASE_PATHS.BOOKING_PAYMENTS}/${BASE_PATHS.IYZICO}`,
    STRIPE_ROOT: `${BASE_PATHS.BOOKING_PAYMENTS}/${BASE_PATHS.STRIPE}`,
    CALLBACK: BASE_PATHS.CALLBACK,
    WEBHOOK: BASE_PATHS.WEBHOOK,
    // Platform defteri mutabakatı: eksik fiş raporu + telafi turu.
    UNBRIDGED: 'unbridged',
    BACKFILL_LEDGER: 'backfill-ledger',
    // Doğrulanamamış / reddedilmiş rezervasyon iadeleri: liste + elle karar + yeniden deneme.
    REFUNDS_UNRESOLVED: 'refunds/unresolved',
    REFUND_RESOLVE: 'refunds/:refundId/resolve',
    REFUND_RETRY: 'refunds/:refundId/retry',
    IYZICO_FULL_CALLBACK_PATH: `${BASE_PATHS.HEALTH_TOURISM}/${BASE_PATHS.BOOKING_PAYMENTS}/${BASE_PATHS.IYZICO}/${BASE_PATHS.CALLBACK}`,
    STRIPE_FULL_WEBHOOK_PATH: `${BASE_PATHS.HEALTH_TOURISM}/${BASE_PATHS.BOOKING_PAYMENTS}/${BASE_PATHS.STRIPE}/${BASE_PATHS.WEBHOOK}`,
  },
} as const;

export type RoutePaths = typeof ROUTE_PATHS;
