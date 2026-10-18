import { Injectable, Logger } from '@nestjs/common';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentReminderDueEvent } from '@modules/clinical/appointment/domain/events/appointment-reminder-due.event';
import { NotificationDispatcherService } from '@modules/platform/notification/application/services/notification-dispatcher.service';
import { OnDomainEvent } from '@common/decorators';

/**
 * Yaklaşan randevu hatırlatması geldiğinde hastaya dış kanaldan bildirim dağıtır
 * (WhatsApp template / e-posta). Cross-module event aboneliği — appointment
 * modülünün fırlattığı {@link AppointmentReminderDueEvent}'i dinler. Hata ana
 * akışı bozmaz, yalnız loglanır.
 */
@Injectable()
export class AppointmentReminderNotificationListener {
  private readonly logger = new Logger(
    AppointmentReminderNotificationListener.name
  );

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @OnDomainEvent(APPOINTMENT_EVENTS.REMINDER_DUE)
  async handle(event: AppointmentReminderDueEvent): Promise<void> {
    try {
      await this.dispatcher.notifyAppointmentReminder({
        appointmentId: event.appointmentId,
        clinicId: event.clinicId,
        patientId: event.patientId,
        patientName: event.patientName,
        patientPhone: event.patientPhone,
        patientEmail: event.patientEmail,
        startTime: event.startTime,
        requireResponse: event.requireResponse,
      });
    } catch (error) {
      this.logger.error(
        `Hatırlatma bildirimi işlenemedi (appointmentId=${event.appointmentId}): ${error}`
      );
    }
  }
}
