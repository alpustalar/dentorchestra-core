import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicAppointmentSettingsResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Temel Randevu ve Rezervasyon İzinleri (Herkes Görebilir) ---
  @Expose() allowPatientBooking: boolean;
  @Expose() allowPatientCancel: boolean;
  @Expose() slotDurationMinutes: number;

  // --- Hasta Paneli Davranış ve Zaman Sınırları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  rescheduleLimitHours: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  cancelLimitHours: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  maxActivePatientBookings: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  maxFutureBookingDays: number;

  // --- Klinik Operasyon ve İş Akışı Kurallaları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  requireConfirmation: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  staffAllowOverbooking: boolean;

  // --- Hatırlatma ve Bildirim Konfigürasyonları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  sendSmsReminderHours: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  requireReminderResponse: boolean;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
