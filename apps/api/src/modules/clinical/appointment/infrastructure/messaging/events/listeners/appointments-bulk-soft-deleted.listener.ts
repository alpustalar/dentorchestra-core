import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APPOINTMENT_JOBS, QUEUES } from '@common/constants';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentsBulkSoftDeletedEvent } from '@modules/clinical/appointment/domain/events/appointments-bulk-soft-deleted.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Toplu randevu soft-delete event'ini kuyruğa devreder. Bildirim + Redis
 * temizliği gibi ağır/asenkron iş senkron listener'da değil, APPOINTMENT
 * queue processor'ında yapılır.
 */
@Injectable()
export class AppointmentsBulkSoftDeletedListener {
  private readonly logger = new Logger(
    AppointmentsBulkSoftDeletedListener.name
  );

  constructor(@InjectQueue(QUEUES.APPOINTMENT) private readonly queue: Queue) {}

  @OnDomainEvent(APPOINTMENT_EVENTS.BULK_SOFT_DELETED)
  async handle(event: AppointmentsBulkSoftDeletedEvent): Promise<void> {
    if (event.affectedCount === 0) return;

    await this.queue.add(
      APPOINTMENT_JOBS.NOTIFY_BULK_SOFT_DELETED,
      {
        scope: event.scope,
        clinicId: event.clinicId,
        organizationId: event.organizationId,
        affectedCount: event.affectedCount,
      },
      { removeOnComplete: true, removeOnFail: 100 }
    );

    this.logger.log(
      `Toplu randevu silme bildirimi kuyruğa alındı: scope=${event.scope}, count=${event.affectedCount}`
    );
  }
}
