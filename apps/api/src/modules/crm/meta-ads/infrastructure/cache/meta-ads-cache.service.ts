import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const META_OAUTH_STATE_TTL_SECONDS = DateTimeManager.toSeconds({ minutes: 10 });

const KEYS = {
  OAUTH_STATE: (state: string) => `meta-ads:oauth-state:${state}`,
};

@Injectable()
export class MetaAdsCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  get metaOAuthState() {
    return {
      set: async (state: string, payload: string) => {
        await this.redis.set(
          KEYS.OAUTH_STATE(state),
          payload,
          'EX',
          META_OAUTH_STATE_TTL_SECONDS
        );
      },
      get: async (state: string) => this.redis.get(KEYS.OAUTH_STATE(state)),
      delete: async (state: string) => {
        await this.redis.del(KEYS.OAUTH_STATE(state));
      },
    };
  }
}
