import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { IOrganizationCacheService } from '@modules/organization/organization/domain/interfaces/organization-cache.service.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const KEYS = {
  ORGANIZATION_ID_BY_CLINIC_ID: (clinicId: string) =>
    `organization-id:by:clinic-id:${clinicId}`,
};

@Injectable()
export class OrganizationCacheService implements IOrganizationCacheService {
  private readonly organizationIdTtl = DateTimeManager.toSeconds({
    minutes: 60,
  });

  constructor(@InjectRedis() private readonly redis: Redis) {}

  organizationIdByClinicId<T = { organizationId: string }>() {
    return {
      get: async <U = T>(clinicId: string): Promise<U | null> => {
        const raw = await this.redis.get(
          KEYS.ORGANIZATION_ID_BY_CLINIC_ID(clinicId)
        );
        if (!raw) return null;

        try {
          return JSON.parse(raw) as U;
        } catch {
          return null;
        }
      },

      set: async <U = T>(clinicId: string, payload: U): Promise<void> => {
        await this.redis.set(
          KEYS.ORGANIZATION_ID_BY_CLINIC_ID(clinicId),
          JSON.stringify(payload),
          'EX',
          this.organizationIdTtl
        );
      },

      del: async (clinicId: string): Promise<number> =>
        this.redis.del(KEYS.ORGANIZATION_ID_BY_CLINIC_ID(clinicId)),
    };
  }
}
