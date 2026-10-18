import { Injectable, Logger } from '@nestjs/common';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentBookedEvent } from '@modules/clinical/appointment/domain/events/book-appointment.event';
import { NotificationDispatcherService } from '@modules/platform/notification/application/services/notification-dispatcher.service';
import { OnDomainEvent } from '@common/decorators';

/**
 * Randevu oluşturulunca (hasta portalı) bildirim dağıtır: personel panel-içi +
 * hasta dış kanal. Cross-module event aboneliği — appointment modülünün yayınladığı
 * {@link AppointmentBookedEvent}'i dinler. Hata ana akışı bozmaz, yalnız loglanır.
 */
@Injectable()
export class AppointmentBookedNotificationListener {
  private readonly logger = new Logger(
    AppointmentBookedNotificationListener.name
  );

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @OnDomainEvent(APPOINTMENT_EVENTS.BOOKED)
  async handle(event: AppointmentBookedEvent): Promise<void> {
    try {
      await this.dispatcher.notifyAppointmentBooked({
        appointmentId: event.appointmentId,
        clinicId: event.clinicId,
        patientId: event.patientId,
        startTime: event.startTime,
      });
    } catch (error) {
      this.logger.error(
        `Randevu bildirimi işlenemedi (appointmentId=${event.appointmentId}): ${error}`
      );
    }
  }
}
