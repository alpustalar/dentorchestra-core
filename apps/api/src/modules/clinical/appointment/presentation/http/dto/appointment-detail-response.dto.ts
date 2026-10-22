import { Expose, Type } from 'class-transformer';
import { AppointmentResponseDto } from './appointment-response.dto';
import { AppointmentsResponseGroups } from '@shared/modules/appointment/constants';

const { INTERNAL, PROVIDER_DATA_OWNER, PATIENT_DATA_OWNER, ADMIN, MANAGEMENT } =
  AppointmentsResponseGroups;

const SHARED = {
  groups: [
    INTERNAL,
    PROVIDER_DATA_OWNER,
    PATIENT_DATA_OWNER,
    ADMIN,
    MANAGEMENT,
  ],
};

const INTERNAL_ONLY = {
  groups: [INTERNAL, PROVIDER_DATA_OWNER, ADMIN, MANAGEMENT],
};

/** Randevu detayında gömülü hasta kartı. Kimlik/iletişim klinik içi gruplara kapalı. */
export class AppointmentPatientDetailDto {
  @Expose() id: string;

  @Expose(SHARED)
  firstName: string;

  @Expose(SHARED)
  lastName: string | null;

  @Expose(SHARED)
  phone: string | null;

  @Expose(SHARED)
  email: string | null;

  // TC kimlik yalnız klinik personeli/yönetim — hasta portalına dahi taşınmaz.
  @Expose(INTERNAL_ONLY)
  tcNo: string | null;
}

/** Doktorun kullanıcı kaydından türeyen görünen ad. */
export class AppointmentProviderUserDetailDto {
  @Expose() id: string;
  @Expose() displayName: string | null;
}

/** Randevu detayında gömülü doktor kartı. */
export class AppointmentProviderDetailDto {
  @Expose() id: string;
  @Expose() title: string | null;
  @Expose() specialty: string | null;

  @Expose()
  @Type(() => AppointmentProviderUserDetailDto)
  user: AppointmentProviderUserDetailDto | null;

  // Doktorun kişisel iletişim kanalları klinik içi bilgidir.
  @Expose(INTERNAL_ONLY)
  publicPhone: string | null;

  @Expose(INTERNAL_ONLY)
  publicEmail: string | null;
}

/** Randevu detayında gömülü tedavi kartı. */
export class AppointmentTreatmentDetailDto {
  @Expose() id: string;
  @Expose() slug: string;
  @Expose() duration: number | null;

  @Expose(INTERNAL_ONLY)
  sutCode: string | null;
}

/** Randevu detayında gömülü klinik kartı. */
export class AppointmentClinicDetailDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() slug: string;
  @Expose() timezone: string;

  @Expose(INTERNAL_ONLY)
  phone: string | null;

  @Expose(INTERNAL_ONLY)
  address: string | null;
}

/**
 * Randevu detayı (AppointmentWithDetails read-model). Randevunun kendi alanlarını
 * AppointmentResponseDto'dan devralır; ilişkili kayıtları id yerine zenginleştirilmiş
 * kartlar olarak döner.
 */
export class AppointmentDetailResponseDto extends AppointmentResponseDto {
  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentPatientDetailDto)
  declare patient: AppointmentPatientDetailDto;

  @Expose()
  @Type(() => AppointmentProviderDetailDto)
  declare provider: AppointmentProviderDetailDto;

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentTreatmentDetailDto)
  declare treatment?: AppointmentTreatmentDetailDto;

  @Expose()
  @Type(() => AppointmentClinicDetailDto)
  declare clinic: AppointmentClinicDetailDto;
}
