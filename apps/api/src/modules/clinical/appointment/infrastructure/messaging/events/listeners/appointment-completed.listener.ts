import { Injectable, Logger } from '@nestjs/common';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentCompletedEvent } from '@modules/clinical/appointment/domain/events/complete-appointment.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Randevu tamamlanmasının yan etkilerini işler (AppointmentCompletedEvent).
 *
 * Bu event, complete handler'da {@link TransactionManager.outboxRun} ile atomik
 * olarak mühürlenir; listener event yayınlandıktan sonra tetiklenir.
 */
@Injectable()
export class AppointmentCompletedListener {
  private readonly logger = new Logger(AppointmentCompletedListener.name);

  @OnDomainEvent(APPOINTMENT_EVENTS.COMPLETED)
  async handle(event: AppointmentCompletedEvent): Promise<void> {
    this.logger.log(
      `Randevu tamamlandı: appointmentId=${event.appointmentId}, clinicId=${event.clinicId}`
    );

    // ── ENTEGRASYON NOKTASI (SEAM) — Ödeme kilidi (geri alınamaz) ──────────
    // Randevu tamamlandıktan sonra ilişkili ödeme "geri alınamaz" olarak
    // işaretlenmelidir. Kural: tüm ödeme işlemleri kuyruk üzerinden yürür.
    // Payment modülünde kilit komutu/kuyruğu hazır olduğunda burada ilgili job
    // enqueue edilir (appointmentId ile). Şimdilik entegrasyon seam'i bırakıldı.
  }
}
