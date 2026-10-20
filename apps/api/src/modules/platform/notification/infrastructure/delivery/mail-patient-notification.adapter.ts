import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMailService,
  MAIL_SERVICE,
} from '@src/infrastructure/mail/interfaces/mail.service.interface';
import {
  PatientNotificationInput,
  PatientNotificationPort,
} from '@modules/platform/notification/domain/ports/patient-notification.port';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Hasta bildirimi adaptörü — strateji: WhatsApp template (öncelikli) + e-posta fallback.
 *
 * WhatsApp HSM için (1) hastaya ait bir conversation ve (2) onaylı bir şablon
 * gerekir (her klinik kendi WABA'sında onaylatır). Bu ikisi hazır olmadığından
 * WhatsApp kolu şimdilik SEAM'dir; teslim e-posta ile yapılır. Şablon + conversation
 * çözümü bağlanınca `SendTemplateMessageCommand` buradan dispatch edilecek.
 */
@Injectable()
export class MailPatientNotificationAdapter implements PatientNotificationPort {
  private readonly logger = new Logger(MailPatientNotificationAdapter.name);

  constructor(
    @Inject(MAIL_SERVICE) private readonly mailService: IMailService
  ) {}

  async notify(input: PatientNotificationInput): Promise<void> {
    // ── WhatsApp template (öncelikli) — SEAM ───────────────────────────────
    // if (input.patientPhone) { conversation + onaylı şablon çözülünce
    //   messaging SendTemplateMessageCommand dispatch edilecek; hata → e-posta. }

    if (!input.patientEmail) {
      this.logger.warn(
        `Hasta bildirimi atlandı — e-posta yok (clinic=${input.clinicId}, kind=${input.kind}).`
      );
      return;
    }

    const { subject, html } = this.render(input);
    await this.mailService.sendNotificationEmail({
      to: input.patientEmail,
      subject,
      html,
    });
  }

  private render(input: PatientNotificationInput): {
    subject: string;
    html: string;
  } {
    const when = DateTimeManager.formatDateTime(input.startTime);
    const greeting = `<p>Sayın ${input.patientName},</p>`;

    switch (input.kind) {
      case 'BOOKING_RECEIVED':
        return {
          subject: 'Randevu talebiniz alındı',
          html: [
            greeting,
            `<p><strong>${when}</strong> tarihli randevu talebiniz alınmıştır.</p>`,
            `<p>Randevunuz klinik onayının ardından kesinleşecektir. Onaylandığında ayrıca bilgilendirileceksiniz.</p>`,
          ].join(''),
        };
      case 'CONFIRMED':
        return {
          subject: 'Randevunuz onaylandı',
          html: [
            greeting,
            `<p><strong>${when}</strong> tarihli randevunuz onaylanmıştır. Sizi bekliyoruz.</p>`,
          ].join(''),
        };
      case 'CANCELLED':
        return {
          subject: 'Randevunuz iptal edildi',
          html: [
            greeting,
            `<p><strong>${when}</strong> tarihli randevunuz iptal edilmiştir.</p>`,
            input.reason ? `<p>Gerekçe: ${input.reason}</p>` : '',
            `<p>Yeni bir randevu için bizimle iletişime geçebilirsiniz.</p>`,
          ].join(''),
        };
      case 'RESCHEDULED':
        return {
          subject: 'Randevunuz yeniden planlandı',
          html: [
            greeting,
            `<p>Randevunuz <strong>${when}</strong> tarihine alınmıştır.</p>`,
          ].join(''),
        };
      case 'REMINDER':
        return {
          subject: 'Randevu hatırlatması',
          html: [
            greeting,
            `<p><strong>${when}</strong> tarihli randevunuzu hatırlatmak isteriz. Sizi bekliyoruz.</p>`,
          ].join(''),
        };
    }
  }
}
