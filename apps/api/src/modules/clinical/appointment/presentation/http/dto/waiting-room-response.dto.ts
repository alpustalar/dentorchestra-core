import { Expose, Type } from 'class-transformer';
import { AppointmentsResponseGroups } from '@shared/modules/appointment/constants';

const { INTERNAL, MANAGEMENT, PROVIDER_DATA_OWNER } =
  AppointmentsResponseGroups;

/**
 * Bekleme odası satırı (WaitingRoomEntry read-model). Sıra/geliş zamanı tabanda;
 * hasta adı ve telefonu klinik içi gruplara kapalıdır.
 */
export class WaitingRoomEntryResponseDto {
  @Expose() appointmentId: string;
  @Expose() providerId: string;
  @Expose() providerName: string | null;

  @Expose()
  @Type(() => Date)
  startTime: Date;

  @Expose()
  @Type(() => Date)
  checkedInAt: Date | null;

  // --- Hasta kimliği / iletişim (klinik içi) ---
  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  patientId: string | null;

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  patientName: string;

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  patientPhone: string;

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  treatmentType: string | null;
}
