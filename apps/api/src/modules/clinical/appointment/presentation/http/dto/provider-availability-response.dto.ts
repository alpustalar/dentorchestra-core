import { Expose, Type } from 'class-transformer';
import { AppointmentsResponseGroups } from '@shared/modules/appointment/constants';

const { INTERNAL, MANAGEMENT, PROVIDER_DATA_OWNER } =
  AppointmentsResponseGroups;

/** Doktorun çalışma saatleri (dakika cinsinden gün içi ofsetler). */
export class ProviderCalendarWorkingHoursResponseDto {
  @Expose() startMinute: number;
  @Expose() endMinute: number;
  @Expose() breakStartMinute: number | null;
  @Expose() breakEndMinute: number | null;
}

/** Doktor istisnası (izin/ek mesai). Gerekçe klinik içi bilgidir. */
export class ProviderCalendarExceptionResponseDto {
  @Expose()
  @Type(() => Date)
  startTime: Date;

  @Expose()
  @Type(() => Date)
  endTime: Date;

  @Expose() type: 'OFF' | 'ON';

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  reason: string | null;
}

/**
 * Dolu slot. Müsaitlik ızgarasını çizmek için aralık ve durum tabandadır;
 * randevu kimliği klinik içi gruplara kapalıdır (hasta kaydına köprü kurar).
 */
export class ProviderCalendarOccupiedSlotResponseDto {
  @Expose()
  @Type(() => Date)
  startTime: Date;

  @Expose()
  @Type(() => Date)
  endTime: Date;

  @Expose() status: string;

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  id: string;
}

/** Doktorun bir gününe ait müsaitlik görünümü. */
export class ProviderCalendarDayResponseDto {
  @Expose() date: string;
  @Expose() isWorkingDay: boolean;

  @Expose({ groups: [PROVIDER_DATA_OWNER, INTERNAL, MANAGEMENT] })
  reason: string | null;

  @Expose()
  @Type(() => ProviderCalendarWorkingHoursResponseDto)
  workingHours: ProviderCalendarWorkingHoursResponseDto | null;

  @Expose()
  @Type(() => ProviderCalendarExceptionResponseDto)
  providerExceptions: ProviderCalendarExceptionResponseDto[];

  @Expose()
  @Type(() => ProviderCalendarOccupiedSlotResponseDto)
  occupiedSlots: ProviderCalendarOccupiedSlotResponseDto[];
}
