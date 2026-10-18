import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SetupApp } from '@common/setup-app';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ENV } from '@common/constants/env.constant';
import { winstonConfig } from '@src/infrastructure/logging/winston.config';
import {
  CriticalFailurePublisher,
  installProcessFailureAlarms,
} from '@common/observability';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    rawBody: true,
  });

  SetupApp(app);

  // Sürecin ölümü de bir uyarıdır: yakalanmayan bir promise reddi uçuşta olan
  // istekleri yarıda bırakır ve finans tarafında bu "para alındı, defter
  // yazılmadı" demektir. Yeniden başlatma sessiz kalmasın.
  installProcessFailureAlarms({ publisher: app.get(CriticalFailurePublisher) });

  const configService = app.get(ConfigService);

  // apps/messaging'in çağırdığı RPC yüzeyi (AI araçları, ActorContext, kontak).
  // HTTP sunucusuyla aynı süreçte dinlenir; ayrı bir process gerekmez.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [configService.getOrThrow<string>(ENV.NATS_URL)],
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    },
  });
  // HTTP'den ÖNCE başlatılır: messaging bir isteği, core henüz dinlemiyorken
  // gönderirse zaman aşımına düşer.
  await app.startAllMicroservices();

  const port = Number(configService.get<number | string>('PORT', 8080));
  await app.listen(port);
}

// Açılış hatası da bir ölümdür ve en sessiz olanıdır: `installProcessFailureAlarms`
// henüz bağlanmamıştır (konteyner yok), uyarı kanalı da yoktur. Elde kalan tek şey
// log'dur — o yüzden en azından hatanın kendisi ve sıfırdan farklı çıkış kodu
// garanti edilir; yakalanmayan bir promise olarak bırakılırsa Node'un genel
// mesajına karışır ve yeniden başlatma döngüsünde sebebi kaybolur.
bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Uygulama ayağa kalkamadı.',
    error instanceof Error ? error.stack : String(error)
  );
  process.exit(1);
});
