import { Injectable, Logger } from '@nestjs/common';
import { APPOINTMENT_EVENTS } from '@src/domain/constants/events';
import { AppointmentCancelledEvent } from '@modules/clinical/appointment/domain/events/cancelled-appointment.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Randevu iptalinin yan etkilerini işler (AppointmentCancelledEvent).
 *
 * Bu event, iptal eden handler'da {@link TransactionManager.outboxRun} ile
 * atomik olarak mühürlenir; bu listener event yayınlandıktan sonra tetiklenir.
 */
@Injectable()
export class AppointmentCancelledListener {
  private readonly logger = new Logger(AppointmentCancelledListener.name);

  @OnDomainEvent(APPOINTMENT_EVENTS.CANCELLED)
  async handle(event: AppointmentCancelledEvent): Promise<void> {
    this.logger.log(
      `Randevu iptal edildi: appointmentId=${event.appointmentId}, clinicId=${event.clinicId}, canceledBy=${event.canceledBy}`
    );

    // ── ENTEGRASYON NOKTASI (SEAM) — Sağlık turizmi iadesi ─────────────────
    // Klinik `Appointment` ile HotelBeds `BookingPayment` arasında henüz DB bağı
    // yok (Appointment.bookingRef / isHealthTourism eklenmedi). Bağ kurulduğunda:
    //   1. event üzerinden ilgili booking(ler) bulunur,
    //   2. her biri için RefundBookingPaymentCommand(bookingId, event.cancelReason)
    //      TSCommandBus ile dispatch edilir.
    // Sahte bir bağ uydurmamak için burada yalnızca seam bırakılmıştır.

    // ── ENTEGRASYON NOKTASI (SEAM) — Hasta bildirimi ───────────────────────
    // event.patientPhone / event.patientEmail üzerinden iptal bildirimi
    // (mail/mesaj) gönderilecek. Bildirim altyapısı bağlanınca doldurulur.
  }
}
