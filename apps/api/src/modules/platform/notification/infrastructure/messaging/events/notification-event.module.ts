import { Logger, Module } from '@nestjs/common';
import { StaffNotificationRepositoryModule } from '@modules/platform/notification/infrastructure/persistence/prisma/repositories/staff-notification/staff-notification.repository.module';
import { NotificationDispatcherService } from '@modules/platform/notification/application/services/notification-dispatcher.service';
import { MailPatientNotificationAdapter } from '@modules/platform/notification/infrastructure/delivery/mail-patient-notification.adapter';
import { PATIENT_NOTIFICATION_PORT } from '@modules/platform/notification/domain/ports/patient-notification.port';
import { AppointmentBookedNotificationListener } from '@modules/platform/notification/infrastructure/messaging/events/listeners/appointment-booked-notification.listener';
import { AppointmentLifecycleNotificationListener } from '@modules/platform/notification/infrastructure/messaging/events/listeners/appointment-lifecycle-notification.listener';
import { AppointmentReminderNotificationListener } from '@modules/platform/notification/infrastructure/messaging/events/listeners/appointment-reminder-notification.listener';
import { WorkOrderOverdueNotificationListener } from '@modules/platform/notification/infrastructure/messaging/events/listeners/work-order-overdue-notification.listener';
import { NotificationRealtimeModule } from '@modules/platform/notification/infrastructure/realtime/notification-realtime.module';
import { MailModule } from '@src/infrastructure/mail/mail.module';
import { CriticalFailureListener } from '@modules/platform/notification/infrastructure/messaging/events/listeners/critical-failure.listener';
import { LogOpsAlertAdapter } from '@modules/platform/notification/infrastructure/delivery/log-ops-alert.adapter';
import { SlackOpsAlertAdapter } from '@modules/platform/notification/infrastructure/delivery/slack-ops-alert.adapter';
import {
  OPS_ALERT_PORT,
  OpsAlertPort,
} from '@common/observability/ops-alert.port';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@common/constants/env.constant';

/**
 * Slack webhook'u tanımlıysa uyarılar kanala, değilse yapılandırılmış log'a gider.
 * Seçim ayağa kalkarken bir kez yapılır; log adaptörü Slack'in erişilemediği
 * anlarda yedek olarak da kullanılır (bkz. `SlackOpsAlertAdapter`).
 *
 * Modül dışına alınmasının sebebi test edilebilirlik: yanlış dallanma, uyarıların
 * sessizce log'da kalması demek olurdu ve bunu ancak üretimde fark ederdik.
 */
export const opsAlertPortFactory = (
  config: ConfigService,
  slack: SlackOpsAlertAdapter,
  log: LogOpsAlertAdapter
): OpsAlertPort => {
  const logger = new Logger('OpsAlertPort');
  const configured =
    config.get<string>(ENV.SLACK_OPS_WEBHOOK_URL) ??
    config.get<string>(ENV.SLACK_OPS_WEBHOOK_URL_CRITICAL);

  if (configured) {
    logger.log('Operasyonel uyarı kanalı: Slack webhook.');
    return slack;
  }

  // Seçim **sessiz** yapılmaz. Kanal yapılandırılmadığında sistem çalışmaya devam
  // eder (uyarı göndermek bir iş gereksinimi değil, operasyon gereksinimidir) ama
  // o andan sonra "CRITICAL uyarı çıkar" diye kapatılmış onlarca güvence yalnız bir
  // log satırına dayanır. Üretimde bunun fark edilmesi şansa bırakılamaz.
  const message =
    "Operasyonel uyarı kanalı YAPILANDIRILMADI: uyarılar yalnız log'a yazılacak. " +
    `Bağlamak için ${ENV.SLACK_OPS_WEBHOOK_URL} tanımlayın (bkz. envs/.env.example).`;

  if (config.get<string>(ENV.MODE) === 'PRODUCTION') logger.error(message);
  else logger.warn(message);

  return log;
};

/**
 * Bildirim yan etkilerini bağlar: domain event dinleyicileri (seam) + merkezi
 * dispatcher + hasta teslim adaptörü (WhatsApp template / e-posta portu).
 */
@Module({
  imports: [
    StaffNotificationRepositoryModule,
    MailModule,
    NotificationRealtimeModule,
  ],
  providers: [
    AppointmentBookedNotificationListener,
    AppointmentLifecycleNotificationListener,
    AppointmentReminderNotificationListener,
    WorkOrderOverdueNotificationListener,
    CriticalFailureListener,
    NotificationDispatcherService,
    {
      provide: PATIENT_NOTIFICATION_PORT,
      useClass: MailPatientNotificationAdapter,
    },
    LogOpsAlertAdapter,
    SlackOpsAlertAdapter,
    {
      provide: OPS_ALERT_PORT,
      inject: [ConfigService, SlackOpsAlertAdapter, LogOpsAlertAdapter],
      useFactory: opsAlertPortFactory,
    },
  ],
})
export class NotificationEventModule {}
