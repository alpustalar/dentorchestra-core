export const ENV = {
  MODE: 'MODE',
  ORIGIN: 'ORIGIN',
  PORT: 'PORT',
  ALLOWED_ORIGINS: 'ALLOWED_ORIGINS',
  ADMIN_EMAIL: 'ADMIN_EMAIL',
  DATABASE_URL: 'DATABASE_URL',
  MONGODB_URI: 'MONGODB_URI',
  // Messaging kendi Mongo veritabanını kullanır (audit log'unkinden ayrı) — Faz 3'te
  // ayrı sürece çıkarken bu URI olduğu gibi taşınır, veri yeniden taşınmaz.
  MESSAGING_MONGODB_URI: 'MESSAGING_MONGODB_URI',
  REDIS_URL: 'REDIS_URL',
  // Servisler arası mesajlaşma (apps/api ↔ apps/messaging).
  NATS_URL: 'NATS_URL',
  BETTERSTACK_TOKEN: 'BETTERSTACK_TOKEN',
  TOKEN_CIPHER_KEY: 'TOKEN_CIPHER_KEY',
  QUEUE_MONITOR_ADMIN_PASSWORD: 'QUEUE_MONITOR_ADMIN_PASSWORD',
  // IYZICO
  IYZICO_API_KEY: 'IYZICO_API_KEY',
  IYZICO_SECRET_KEY: 'IYZICO_SECRET_KEY',
  IYZICO_BASE_URL: 'IYZICO_BASE_URL',
  IYZICO_TERMINAL_BASE_URL: 'IYZICO_TERMINAL_BASE_URL',
  /**
   * Fiziksel POS callback'inin HMAC-SHA256 imza anahtarı. **Tanımlı değilse
   * callback reddedilir** (fail-closed): imzasız bir callback, PENDING bir POS
   * işlemini "başarılı" yapıp para alınmadan tahsilat/gelir yazdırabilir.
   */
  POS_CALLBACK_SECRET: 'POS_CALLBACK_SECRET',
  // EMAIL
  EMAIL_ADDRESS: 'EMAIL_ADDRESS',
  EMAIL_PASSWORD: 'EMAIL_PASSWORD',
  EMAIL_SMTP_HOST: 'EMAIL_SMTP_HOST',
  EMAIL_SMTP_PORT: 'EMAIL_SMTP_PORT',
  // META
  META_APP_ID: 'META_APP_ID',
  META_APP_SECRET: 'META_APP_SECRET',
  META_WEBHOOK_VERIFY_TOKEN: 'META_WEBHOOK_VERIFY_TOKEN',
  META_OAUTH_REDIRECT_URI: 'META_OAUTH_REDIRECT_URI',
  // WHATSAPP
  WHATSAPP_APP_ID: 'WHATSAPP_APP_ID',
  WHATSAPP_APP_SECRET: 'WHATSAPP_APP_SECRET',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  // AI
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  ANTHROPIC_DEFAULT_MODEL: 'ANTHROPIC_DEFAULT_MODEL',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_DEFAULT_MODEL: 'GEMINI_DEFAULT_MODEL',
  // TELEGRAM (MTProto api_id/api_hash app-seviyesi; Bot token klinik başına DB'de şifreli)
  TELEGRAM_API_ID: 'TELEGRAM_API_ID',
  TELEGRAM_API_HASH: 'TELEGRAM_API_HASH',
  PUBLIC_BASE_URL: 'PUBLIC_BASE_URL', // Telegram bot webhook URL'i için açık HTTPS taban
  // INSTAGRAM (Meta Graph / Messenger Platform — app-seviyesi; Page/IG token klinik başına DB'de şifreli)
  INSTAGRAM_APP_ID: 'INSTAGRAM_APP_ID',
  INSTAGRAM_APP_SECRET: 'INSTAGRAM_APP_SECRET',
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
  // HOTEL BEDS
  HOTELBEDS_HOTEL_API_KEY: 'HOTELBEDS_HOTEL_API_KEY',
  HOTELBEDS_HOTEL_SECRET: 'HOTELBEDS_HOTEL_SECRET',
  HOTELBEDS_TRANSFER_API_KEY: 'HOTELBEDS_TRANSFER_API_KEY',
  HOTELBEDS_TRANSFER_SECRET: 'HOTELBEDS_TRANSFER_SECRET',
  // DUFFEL (uçuş) — test/canlı ayrımı token'ın kendisindedir: duffel_test_… / duffel_live_…
  DUFFEL_ACCESS_TOKEN: 'DUFFEL_ACCESS_TOKEN',
  // STRIPE (yurtdışı müşteri için EUR/USD ödeme linki — sağlık turizmi B7)
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
  // Stripe ödeme LİNKİ ÜRETİMİNİ açar (yalnız 'true'). Varsayılan KAPALI: Stripe parası için
  // kapanış akışı (payout→102, Stripe ücreti, itiraz, kur farkı) yok (kural 16).
  STRIPE_PAYMENT_LINKS_ENABLED: 'STRIPE_PAYMENT_LINKS_ENABLED',
  // FX — net (EUR/USD) → TRY çevrimi (iyzico TRY ister); v1 statik env oranı
  FX_EUR_TRY: 'FX_EUR_TRY',
  FX_USD_TRY: 'FX_USD_TRY',
  FX_GBP_TRY: 'FX_GBP_TRY',
  // OPS UYARI KANALI — yutulmuş kritik hatalar (CriticalFailureEvent) buraya düşer.
  // Tanımlı değilse uyarılar yapılandırılmış log'a yazılır (yerel/test).
  SLACK_OPS_WEBHOOK_URL: 'SLACK_OPS_WEBHOOK_URL',
  /** CRITICAL uyarıları ayrı bir kanala ayırmak için (opsiyonel). */
  SLACK_OPS_WEBHOOK_URL_CRITICAL: 'SLACK_OPS_WEBHOOK_URL_CRITICAL',
  // Sağlık turizmi (otel + transfer) satış komisyonu % — PLATFORM geliri (klinik değil).
  // Satış = net × (1 + oran/100). Tek platform-global oran; klinik başına ayarlanamaz.
  HEALTH_TOURISM_SERVICE_FEE_PERCENT: 'HEALTH_TOURISM_SERVICE_FEE_PERCENT',
} as const;

export type EnvConstant = (typeof ENV)[keyof typeof ENV];
