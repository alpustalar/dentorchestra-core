import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AppointmentStatusType, AppointmentStatusSchema } from '@input-type-schemas/AppointmentStatusSchema';
import { AppointmentsResponseGroups } from '@shared/modules/appointment/constants';

const { INTERNAL, MANAGEMENT, PROVIDER_DATA_OWNER, ADMIN } =
  AppointmentsResponseGroups;

const INTERNAL_ONLY = {
  groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN],
};
/**
 * Takvim olayı (ClinicCalendarEvent read-model). Zaman/durum bilgisi takvim
 * ızgarasını çizmek için tabandadır; hasta kimliği ve iletişim bilgisi klinik
 * içi gruplara kapalıdır.
 */
export class ClinicCalendarEventResponseDto {
  @Expose() appointmentId: string;
  @Expose() providerId: string;
  @Expose() providerName: string | null;

  @Expose()
  @Type(() => Date)
  startTime: Date;

  @Expose()
  @Type(() => Date)
  endTime: Date;

  @ApiProperty({ enum: AppointmentStatusSchema.options })
  @Expose() status: AppointmentStatusType;
  @Expose() isConsultation: boolean;

  // --- Hasta kimliği / iletişim (klinik içi) ---
  @Expose(INTERNAL_ONLY)
  patientId: string | null;

  @Expose(INTERNAL_ONLY)
  patientName: string;

  @Expose(INTERNAL_ONLY)
  patientPhone: string;

  @Expose(INTERNAL_ONLY)
  treatmentType: string | null;
}

/** Bir güne ait (klinik yerelinde) takvim olayları. */
export class ClinicCalendarDayResponseDto {
  @Expose() date: string;

  @Expose()
  @Type(() => ClinicCalendarEventResponseDto)
  events: ClinicCalendarEventResponseDto[];
}
