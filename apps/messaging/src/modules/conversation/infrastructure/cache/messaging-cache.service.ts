import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  MESSAGING_SEND_CLINIC_RATE_MAX,
  MESSAGING_SEND_CLINIC_RATE_WINDOW_SECONDS,
} from '@messaging/constants/jobs.constant';
import {
  AcquireDeliveryLockPayload,
  AcquireInboundLockPayload,
  ConsumeSendQuotaPayload,
  DeliveryLockResult,
  IDeliveryLockOperations,
  IInboundDedupOperations,
  IMessagingCacheService,
  InboundLockResult,
  ISendQuotaOperations,
  ReleaseDeliveryLockPayload,
  ReleaseInboundLockPayload,
  SendQuotaResult,
} from '@modules/conversation/domain/interfaces/messaging-cache.service.interface';
import { MessageChannelType as MessageChannel } from '@shared';

const KEYS = {
  // Cluster uyumluluğu için hash tag ({...}) ile aynı slota sabitlenir.
  INBOUND_DEDUP: (channel: MessageChannel, externalId: string) =>
    `messaging:inbound:v1:${channel}:{${externalId}}`,
  SEND_QUOTA: (clinicId: string) => `messaging:send-quota:v1:{${clinicId}}`,
  DELIVERY_LOCK: (conversationId: string) =>
    `messaging:delivery-lock:v1:{${conversationId}}`,
};

/** SET NX PX; alındıysa -1, alınamadıysa kalan TTL (ms, en az 1). */
const ACQUIRE_LOCK_LUA = `
  if redis.call("set", KEYS[1], ARGV[1], "PX", ARGV[2], "NX") then
    return -1
  end
  local ttl = redis.call("pttl", KEYS[1])
  if ttl < 1 then ttl = 1 end
  return ttl
`;

/** Kilidi yalnız sahibi siler (başkasının TTL sonrası aldığı kilit düşürülmez). */
const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Sorted-set tabanlı kayan pencere. Zaman damgası Redis'in kendi saatinden (TIME)
 * alınır; birden çok worker process'i arasında saat kayması olasılığını eler.
 * Hak varsa -1, doluysa en eski kaydın pencereden çıkmasına kalan süre (ms) döner.
 */
const CONSUME_QUOTA_LUA = `
  local now = redis.call("time")
  local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
  local windowMs = tonumber(ARGV[1])
  local limit = tonumber(ARGV[2])

  redis.call("zremrangebyscore", KEYS[1], 0, nowMs - windowMs)

  if redis.call("zcard", KEYS[1]) < limit then
    redis.call("zadd", KEYS[1], nowMs, ARGV[3])
    redis.call("pexpire", KEYS[1], windowMs)
    return -1
  end

  local oldest = redis.call("zrange", KEYS[1], 0, 0, "WITHSCORES")
  local retryAfter = (tonumber(oldest[2]) + windowMs) - nowMs
  if retryAfter < 1 then retryAfter = 1 end
  return retryAfter
`;

/**
 * Messaging bounded-context'inin Redis servisleri:
 *
 * - `inboundDedup` — Meta/Telegram aynı webhook'u tekrar iletebiliyor. Kilit, mükerrer
 *   teslimin eşzamanlı işlenmesini keser. Kalıcı garanti hâlâ `@@unique(externalId)`
 *   kısıtıdır; buradaki kilit yalnız yarış penceresini ve hızlı retry'ları kapatır.
 * - `sendQuota` — WhatsApp limitleri numara (klinik) başınadır; worker-geneli BullMQ
 *   limiter'ı tek bir kliniğin tüm kotayı yemesini engelleyemez.
 * - `deliveryLock` — kuyruk eşzamanlılığı > 1 olduğunda aynı yazışmanın iki mesajı
 *   paralel uçup sıra bozulabilir; yazışma başına mutex bunu engeller.
 */
@Injectable()
export class MessagingCacheService implements IMessagingCacheService {
  private readonly inboundDedupTtl = DateTimeManager.toSeconds({ minutes: 15 });
  private readonly deliveryLockTtl = DateTimeManager.toSeconds({ seconds: 60 });

  constructor(@InjectRedis() private readonly redis: Redis) {
    // defineCommand I/O yapmaz, yalnız client'a metot ekler — lifecycle hook gerekmez.
    this.redis.defineCommand('acquireMessagingLock', {
      numberOfKeys: 1,
      lua: ACQUIRE_LOCK_LUA,
    });
    this.redis.defineCommand('releaseMessagingLock', {
      numberOfKeys: 1,
      lua: RELEASE_LOCK_LUA,
    });
    this.redis.defineCommand('consumeMessagingQuota', {
      numberOfKeys: 1,
      lua: CONSUME_QUOTA_LUA,
    });
  }

  get inboundDedupTtlSeconds(): number {
    return this.inboundDedupTtl;
  }

  get deliveryLockTtlSeconds(): number {
    return this.deliveryLockTtl;
  }

  get inboundDedup(): IInboundDedupOperations {
    return {
      acquire: async (
        payload: AcquireInboundLockPayload
      ): Promise<InboundLockResult> => {
        const ttlMs = DateTimeManager.toMilliseconds({
          seconds: payload.ttlSeconds ?? this.inboundDedupTtlSeconds,
        });
        const acquired = await this.redis.acquireMessagingLock(
          KEYS.INBOUND_DEDUP(payload.channel, payload.externalId),
          payload.holderId,
          ttlMs.toString()
        );
        return acquired === -1
          ? { status: 'acquired' }
          : { status: 'duplicate' };
      },

      release: async (payload: ReleaseInboundLockPayload): Promise<void> => {
        await this.redis.releaseMessagingLock(
          KEYS.INBOUND_DEDUP(payload.channel, payload.externalId),
          payload.holderId
        );
      },
    };
  }

  get sendQuota(): ISendQuotaOperations {
    return {
      consume: async (
        payload: ConsumeSendQuotaPayload
      ): Promise<SendQuotaResult> => {
        const windowMs = DateTimeManager.toMilliseconds({
          seconds:
            payload.windowSeconds ?? MESSAGING_SEND_CLINIC_RATE_WINDOW_SECONDS,
        });
        const limit = payload.limit ?? MESSAGING_SEND_CLINIC_RATE_MAX;

        const retryAfterMs = await this.redis.consumeMessagingQuota(
          KEYS.SEND_QUOTA(payload.clinicId),
          windowMs.toString(),
          limit.toString(),
          // Aynı milisaniyede düşen iki hak birbirini ezmesin diye benzersiz üye.
          UUID.generate().value
        );

        return retryAfterMs === -1
          ? { status: 'allowed' }
          : { status: 'throttled', retryAfterMs };
      },
    };
  }

  get deliveryLock(): IDeliveryLockOperations {
    return {
      acquire: async (
        payload: AcquireDeliveryLockPayload
      ): Promise<DeliveryLockResult> => {
        const ttlMs = DateTimeManager.toMilliseconds({
          seconds: payload.ttlSeconds ?? this.deliveryLockTtlSeconds,
        });
        const retryAfterMs = await this.redis.acquireMessagingLock(
          KEYS.DELIVERY_LOCK(payload.conversationId),
          payload.holderId,
          ttlMs.toString()
        );
        return retryAfterMs === -1
          ? { status: 'acquired' }
          : { status: 'busy', retryAfterMs };
      },

      release: async (payload: ReleaseDeliveryLockPayload): Promise<void> => {
        await this.redis.releaseMessagingLock(
          KEYS.DELIVERY_LOCK(payload.conversationId),
          payload.holderId
        );
      },
    };
  }
}
