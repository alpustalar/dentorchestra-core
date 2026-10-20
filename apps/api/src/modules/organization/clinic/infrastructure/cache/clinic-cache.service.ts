import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { IClinicCacheService } from '@modules/organization/clinic/domain/interfaces/clinic-cache.service.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { TimeZoneType } from '@input-type-schemas/TimeZoneSchema';

const KEYS = {
  DEACTIVATED: (clinicId: string) => `clinic:deactivated:${clinicId}`,
  SETTINGS: (clinicId: string) => `clinic:settings:${clinicId}`,
  // Randevu davranış ayarları (satellite) okuma-modeli cache'i — randevu oluşturma
  // gibi hot-path'lerde tekrar tekrar DB'ye gidilmesin diye. Ayar güncellenince bust.
  APPOINTMENT_SETTINGS: (clinicId: string) =>
    `clinic:appointment-settings:${clinicId}`,
  CLINIC_ID_BY_PATIENT_ID: (patientId: string) =>
    `clinic:clinic-id-by-patient-id:${patientId}`,
  CLINIC_ID_BY_PROVIDER_ID: (providerId: string) =>
    `clinic:clinic-id-by-provider-id:${providerId}`,
  CLINIC_ORGANIZATION_ID: (clinicId: string) =>
    `clinic:organization-id:${clinicId}`,
  CLINIC_TIMEZONE: (clinicId: string) => `clinic:timezone:${clinicId}`,
};

@Injectable()
export class ClinicCacheService implements IClinicCacheService {
  private readonly appointmentSettingsTtl = DateTimeManager.toSeconds({
    minutes: 30,
  });
  private readonly slotLockTtl = DateTimeManager.toSeconds({ minutes: 2 });
  private readonly clinicIdTtl = DateTimeManager.toSeconds({ minutes: 30 });

  constructor(@InjectRedis() private readonly redis: Redis) {}

  get slotLockTtlSeconds(): number {
    return this.slotLockTtl;
  }

  clinicAppointmentSettings<T = unknown>() {
    return {
      set: async <U = T>(clinicId: string, settings: U): Promise<void> => {
        await this.redis.set(
          KEYS.APPOINTMENT_SETTINGS(clinicId),
          JSON.stringify(settings),
          'EX',
          this.appointmentSettingsTtl
        );
      },

      get: async <U = T>(clinicId: string): Promise<U | null> => {
        const raw = await this.redis.get(KEYS.APPOINTMENT_SETTINGS(clinicId));
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      del: async (clinicId: string): Promise<number> =>
        this.redis.del(KEYS.APPOINTMENT_SETTINGS(clinicId)),
    };
  }

  clinicIdByPatientId<T = { clinicId: string }>() {
    return {
      set: async <U = T>(patientId: string, payload: U): Promise<void> => {
        await this.redis.set(
          KEYS.CLINIC_ID_BY_PATIENT_ID(patientId),
          JSON.stringify(payload),
          'EX',
          this.clinicIdTtl
        );
      },

      get: async <U = T>(patientId: string): Promise<U | null> => {
        const raw = await this.redis.get(
          KEYS.CLINIC_ID_BY_PATIENT_ID(patientId)
        );
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      del: async (patientId: string): Promise<number> => {
        return this.redis.del(KEYS.CLINIC_ID_BY_PATIENT_ID(patientId));
      },
    };
  }

  clinicIdByProviderId<T = { clinicId: string }>() {
    return {
      set: async <U = T>(providerId: string, payload: U): Promise<void> => {
        await this.redis.set(
          KEYS.CLINIC_ID_BY_PROVIDER_ID(providerId),
          JSON.stringify(payload),
          'EX',
          this.clinicIdTtl
        );
      },

      get: async <U = T>(providerId: string): Promise<U | null> => {
        const raw = await this.redis.get(
          KEYS.CLINIC_ID_BY_PROVIDER_ID(providerId)
        );
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      del: async (providerId: string): Promise<number> => {
        return this.redis.del(KEYS.CLINIC_ID_BY_PROVIDER_ID(providerId));
      },
    };
  }

  clinicOrganizationId<T = { organizationId: string }>() {
    return {
      set: async <U = T>(clinicId: string, payload: U): Promise<void> => {
        await this.redis.set(
          KEYS.CLINIC_ORGANIZATION_ID(clinicId),
          JSON.stringify(payload),
          'EX',
          this.clinicIdTtl
        );
      },

      get: async <U = T>(clinicId: string): Promise<U | null> => {
        const raw = await this.redis.get(KEYS.CLINIC_ORGANIZATION_ID(clinicId));
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      del: async (clinicId: string): Promise<number> => {
        return this.redis.del(KEYS.CLINIC_ORGANIZATION_ID(clinicId));
      },
    };
  }

  /**
   * Kliniğin IANA saat dilimi. Slot/takvim hesaplarında her istekte okunduğu için
   * cache'lenir; klinik ayarı değişince bust edilir.
   */
  clinicTimeZone<T = { timezone: TimeZoneType }>() {
    return {
      set: async <U = T>(clinicId: string, payload: U): Promise<void> => {
        await this.redis.set(
          KEYS.CLINIC_TIMEZONE(clinicId),
          JSON.stringify(payload),
          'EX',
          this.clinicIdTtl
        );
      },

      get: async <U = T>(clinicId: string): Promise<U | null> => {
        const raw = await this.redis.get(KEYS.CLINIC_TIMEZONE(clinicId));
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      del: async (clinicId: string): Promise<number> => {
        return this.redis.del(KEYS.CLINIC_TIMEZONE(clinicId));
      },
    };
  }
}
