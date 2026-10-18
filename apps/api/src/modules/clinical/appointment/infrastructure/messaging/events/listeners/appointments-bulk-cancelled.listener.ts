import { Injectable, Logger } from '@nestjs/common';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentsBulkCancelledEvent } from '@modules/clinical/appointment/domain/events/appointments-bulk-cancelled.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Doktor-günü toplu iptalinin yan etkilerini işler (AppointmentsBulkCancelledEvent).
 * Event, iptal handler'ında {@link TransactionManager.outboxRun} ile atomik mühürlenir.
 */
@Injectable()
export class AppointmentsBulkCancelledListener {
  private readonly logger = new Logger(AppointmentsBulkCancelledListener.name);

  @OnDomainEvent(APPOINTMENT_EVENTS.BULK_CANCELLED)
  async handle(event: AppointmentsBulkCancelledEvent): Promise<void> {
    if (event.affectedCount === 0) return;

    this.logger.log(
      `Doktor-günü toplu iptal: providerId=${event.providerId}, clinicId=${event.clinicId}, count=${event.affectedCount}`
    );

    // ── ENTEGRASYON NOKTASI (SEAM) — Hasta bildirimi ───────────────────────
    // İptal edilen randevuların hastalarına toplu bildirim (mesaj/e-posta)
    // gönderilecek. Ağır/asenkron iş için APPOINTMENT queue'ya devredilebilir;
    // bildirim altyapısı bağlanınca doldurulur.
  }
}
