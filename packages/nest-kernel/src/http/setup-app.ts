import helmet from 'helmet';
import {
  ExceptionFilter,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { API_CONFIG } from '@shared/common/constants/api-config.constant';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SetupAppOptions {
  /**
   * Servisin hata filtresi. Çekirdek `BaseExceptionFilter`'ı doğrudan verilebilir;
   * api kendi Prisma dalını ekleyen alt sınıfını verir.
   */
  exceptionFilter: ExceptionFilter;
}

/**
 * Tüm HTTP servislerinin ortak açılış ayarı: sürümleme, güvenlik başlıkları,
 * CORS, hata filtresi ve doğrulama pipe'ları.
 *
 */
export const setupApp = (
  app: INestApplication,
  options: SetupAppOptions
): void => {
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_CONFIG.CURRENT_VERSION,
    prefix: `${API_CONFIG.PREFIX}/${API_CONFIG.VERSION_PREFIX}`,
  });

  app.use(helmet());

  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    // `x-source-type` listede olmazsa tarayıcı preflight'ı reddeder ve istek
    // hiç ulaşmaz. AuthGuard bu başlığı okuyup `actor.source`'a yazıyor; başlık
    // düşerse her web isteği audit log'a SYSTEM olarak geçer.
    allowedHeaders: 'Content-Type, Accept, Authorization, x-source-type',
  });

  app.useGlobalFilters(options.exceptionFilter);

  // Ters vekil (reverse proxy) arkasında çalışırken istemci IP'si ve protokol
  // X-Forwarded-* başlıklarından okunur; bu olmadan rate-limit ve loglar
  // vekilin IP'sini görür.

  if (isProduction) {
    const instance = app.getHttpAdapter().getInstance();
    if (typeof instance?.set === 'function') {
      instance.set('trust proxy', 1);
    }
  }

  app.useGlobalPipes(
    new ZodValidationPipe(),
    new ValidationPipe({ whitelist: true, transform: true })
  );

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Core CRM API')
      .setDescription('Core CRM B2B SaaS API Dokümantasyonu')
      .setVersion(API_CONFIG.CURRENT_VERSION)
      // nestjs-zod JSON Schema 2020 üretir (`type: 'null'`); 3.0 şeması bunu
      // reddeder ve Orval doğrulamada düşer.
      .setOpenAPIVersion('3.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      ignoreGlobalPrefix: true,
    });

    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'api-json',
    });
  }

  app.enableShutdownHooks();
};
