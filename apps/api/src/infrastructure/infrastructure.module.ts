import { ConfigModule, ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { ENV } from '@common/constants/env.constant';
import { ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule as IoRedisModule } from '@nestjs-modules/ioredis/dist/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';
import path from 'node:path';
import { MESSAGING_MONGO_CONNECTION } from '@src/infrastructure/persistence/mongo/mongo.connection';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(
        process.cwd(),
        'envs',
        `.env.${process.env.NODE_ENV ?? 'development'}`
      ),
      validationSchema: Joi.object({
        // ⚙️ Core & Server Settings
        [ENV.MODE]: Joi.string()
          .valid('DEVELOPMENT', 'PRODUCTION', 'TEST')
          .default('DEVELOPMENT'),
        [ENV.PORT]: Joi.number().port().default(8080).required(),
        [ENV.ORIGIN]: Joi.string().uri().required(),
        [ENV.ALLOWED_ORIGINS]: Joi.string().required(),
        [ENV.ADMIN_EMAIL]: Joi.string().email().required(),

        // Databases & Infrastructures
        [ENV.DATABASE_URL]: Joi.string().required(),
        [ENV.MONGODB_URI]: Joi.string().required(),
        [ENV.MESSAGING_MONGODB_URI]: Joi.string().required(),
        [ENV.REDIS_URL]: Joi.string().required(),
        // apps/messaging ile RPC/olay kanalı.
        [ENV.NATS_URL]: Joi.string().required(),

        // Observability / Logging
        [ENV.BETTERSTACK_TOKEN]: Joi.string().required(),

        // Ops uyarı kanalı opsiyoneldir: tanımsızsa uyarılar log'a düşer, uygulama
        // ayağa kalkmayı reddetmez (yerel geliştirme ve test bu yolda çalışır).
        [ENV.SLACK_OPS_WEBHOOK_URL]: Joi.string().uri().optional(),
        [ENV.SLACK_OPS_WEBHOOK_URL_CRITICAL]: Joi.string().uri().optional(),

        // Stripe ödeme linki üretimi opsiyoneldir ve varsayılan KAPALIdır; yalnız 'true' açar.
        [ENV.STRIPE_PAYMENT_LINKS_ENABLED]: Joi.string()
          .valid('true', 'false')
          .optional(),

        // Security & Encryption
        [ENV.TOKEN_CIPHER_KEY]: Joi.string().hex().length(64).required(), // 32 byte hex = 64 karakter

        // Mail Service (Nodemailer)
        [ENV.EMAIL_SMTP_HOST]: Joi.string().required(),
        [ENV.EMAIL_SMTP_PORT]: Joi.number().port().required(),
        [ENV.EMAIL_ADDRESS]: Joi.string().email().required(),
        [ENV.EMAIL_PASSWORD]: Joi.string().required(),

        // Payment Integration (Iyzico)
        [ENV.IYZICO_API_KEY]: Joi.string().required(),
        [ENV.IYZICO_SECRET_KEY]: Joi.string().required(),
        [ENV.IYZICO_BASE_URL]: Joi.string().uri().required(),
        [ENV.IYZICO_TERMINAL_BASE_URL]: Joi.string().uri().required(),

        // Queue & Background Tasks
        [ENV.QUEUE_MONITOR_ADMIN_PASSWORD]: Joi.string().required(),

        // Meta & WhatsApp Integration
        [ENV.META_APP_ID]: Joi.string().required(),
        [ENV.META_APP_SECRET]: Joi.string().required(),
        [ENV.META_OAUTH_REDIRECT_URI]: Joi.string().uri().required(),
        [ENV.META_WEBHOOK_VERIFY_TOKEN]: Joi.string().required(),

        [ENV.WHATSAPP_APP_ID]: Joi.string().required(),
        [ENV.WHATSAPP_APP_SECRET]: Joi.string().required(),
        [ENV.WHATSAPP_WEBHOOK_VERIFY_TOKEN]: Joi.string().required(),

        // AI Fallback Engine
        [ENV.ANTHROPIC_API_KEY]: Joi.string().required(),
        [ENV.ANTHROPIC_DEFAULT_MODEL]: Joi.string().required(),

        // Integration Hotel Beds
        [ENV.HOTELBEDS_HOTEL_API_KEY]: Joi.string().required(),
        [ENV.HOTELBEDS_HOTEL_SECRET]: Joi.string().required(),
        [ENV.HOTELBEDS_TRANSFER_API_KEY]: Joi.string().required(),
        [ENV.HOTELBEDS_TRANSFER_SECRET]: Joi.string().required(),

        // Integration Duffel (uçuş) — bilinçli olarak OPSİYONEL: token yoksa yalnız
        // uçuş uçları çalışmaz, uygulamanın tamamı ayağa kalkmayı sürdürür. Eksikliği
        // DuffelApiService ilk çağrıda DuffelCredentialsMissingException ile bildirir
        // (StripeClientFactory'nin tembel doğrulama deseni).
        [ENV.DUFFEL_ACCESS_TOKEN]: Joi.string()
          .pattern(/^duffel_(test|live)_/)
          .optional(),

        [ENV.HEALTH_TOURISM_SERVICE_FEE_PERCENT]: Joi.number()
          .min(0)
          .max(100)
          .default(5),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get(ENV.MONGODB_URI),
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    // Messaging'in kendi veritabanı — audit log'un varsayılan bağlantısından ayrıdır.
    // Transaction gerektirdiği için URI replica set'e işaret etmelidir (?replicaSet=rs0).
    MongooseModule.forRootAsync({
      connectionName: MESSAGING_MONGO_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get(ENV.MESSAGING_MONGODB_URI),
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    IoRedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get(ENV.REDIS_URL),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get(ENV.REDIS_URL),
        },
        prefix: 'bull_queue',
      }),
    }),
    EventEmitterModule.forRoot(),
  ],
  exports: [ConfigModule, MongooseModule, BullModule, IoRedisModule],
})
export class InfrastructureModule {}
