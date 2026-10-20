import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TenantEntitlements } from '@common/interfaces';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ISubscriptionCacheService } from '@modules/platform/subscription/domain/interfaces/subscription-cache.service.interface';

const KEYS = {
  // Kiracı (org/klinik) entitlement cache'i — abonelik event'lerinde bust edilir.
  ENTITLEMENTS: (organizationId: string, clinicId?: string | null) =>
    `subscription:entitlements:${organizationId}:${clinicId ?? 'ORG'}`,
  // Bir org'a ait tüm entitlement anahtarlarını (org + klinikleri) toplu bust için desen.
  ENTITLEMENTS_ORG_PATTERN: (organizationId: string) =>
    `subscription:entitlements:${organizationId}:*`,
};

@Injectable()
export class SubscriptionCacheService implements ISubscriptionCacheService {
  private readonly entitlementsTtl = DateTimeManager.toSeconds({
    minutes: 6,
  });

  constructor(@InjectRedis() private readonly redis: Redis) {}

  get tenantEntitlements() {
    return {
      set: async <T = TenantEntitlements>(payload: {
        organizationId: string;
        clinicId: string | null;
        entitlements: T;
      }): Promise<void> => {
        await this.redis.set(
          KEYS.ENTITLEMENTS(payload.organizationId, payload.clinicId),
          JSON.stringify(payload.entitlements),
          'EX',
          this.entitlementsTtl
        );
      },

      get: async <T = TenantEntitlements>(
        organizationId: string,
        clinicId: string | null
      ): Promise<T | null> => {
        const raw = await this.redis.get(
          KEYS.ENTITLEMENTS(organizationId, clinicId)
        );
        if (!raw) return null;

        try {
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      },

      /** Bir org'a ait tüm entitlement anahtarlarını (org + tüm klinikleri) toplu bust eder. */
      delByOrganizationId: async (organizationId: string): Promise<void> => {
        const pattern = KEYS.ENTITLEMENTS_ORG_PATTERN(organizationId);
        const stream = this.redis.scanStream({ match: pattern, count: 100 });
        const keys: string[] = [];

        for await (const batch of stream) {
          keys.push(...(batch as string[]));
        }

        if (keys.length > 0) {
          await this.redis.unlink(...keys);
        }
      },
    };
  }
}
