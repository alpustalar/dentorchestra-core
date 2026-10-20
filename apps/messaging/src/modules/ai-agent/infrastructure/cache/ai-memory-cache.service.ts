import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { AI_MEMORY_WINDOW_SIZE } from '@messaging/constants/jobs.constant';
import { AiChatMessage } from '@modules/ai-agent/domain/ports/ai-chat.port';
import {
  AppendAiMemoryPayload,
  IAiMemoryCacheService,
  WarmAiMemoryPayload,
} from '@modules/ai-agent/domain/interfaces/ai-memory-cache.service.interface';

const KEYS = {
  // Pencere ve işaret aynı hash tag'i taşır → cluster'da aynı slot (çok-anahtarlı Lua).
  WINDOW: (conversationId: string) =>
    `messaging:ai-memory:v1:{${conversationId}}:window`,
  MARKER: (conversationId: string) =>
    `messaging:ai-memory:v1:{${conversationId}}:warm`,
};

/**
 * İşaret yoksa pencere soğuktur → nil döner ve çağıran DB'ye düşer. Pencere listesi
 * kendi başına ayırt edici değildir: "hiç ısıtılmadı" ile "ısıtıldı ama metin yok"
 * ikisi de boş listedir.
 */
const READ_MEMORY_LUA = `
  if redis.call("exists", KEYS[2]) == 0 then
    return false
  end
  return redis.call("lrange", KEYS[1], 0, -1)
`;

/**
 * Yalnız ısıtılmış pencereye ekler. Soğukken eklemek, TTL'i dolmuş bir yazışmada tek
 * mesajlık sahte bir geçmiş üretir ve model önceki turları unutur — bu yüzden 0 döner
 * ve pencere soğuk bırakılır (sonraki okuma DB'den tam geçmişi yükler).
 */
const APPEND_MEMORY_LUA = `
  if redis.call("exists", KEYS[2]) == 0 then
    return 0
  end
  redis.call("rpush", KEYS[1], ARGV[1])
  redis.call("ltrim", KEYS[1], -tonumber(ARGV[2]), -1)
  redis.call("expire", KEYS[1], ARGV[3])
  redis.call("expire", KEYS[2], ARGV[3])
  return 1
`;

/**
 * AI sohbet bağlam penceresini (son N tur) Redis'te tutar. Amaç her AI turunda
 * mesaj tablosuna gitmemek: sıcak yazışmalarda geçmiş tek bir `LRANGE` ile gelir.
 *
 * Cache otoritatif değildir — kaybı/dolması yalnız bir DB okumasına mal olur. Bu yüzden
 * tüm Redis hataları yutulur ve çağıran DB yoluna düşer (AI yanıtı Redis'e bağlı olamaz).
 */
@Injectable()
export class AiMemoryCacheService implements IAiMemoryCacheService {
  private readonly logger = new Logger(AiMemoryCacheService.name);
  // WhatsApp servis penceresiyle hizalı; daha eski yazışmada bağlam zaten yenilenir.
  private readonly ttlSeconds = DateTimeManager.toSeconds({ hours: 24 });

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redis.defineCommand('readAiMemory', {
      numberOfKeys: 2,
      lua: READ_MEMORY_LUA,
    });
    this.redis.defineCommand('appendAiMemory', {
      numberOfKeys: 2,
      lua: APPEND_MEMORY_LUA,
    });
  }

  get windowSize(): number {
    return AI_MEMORY_WINDOW_SIZE;
  }

  async read(conversationId: string): Promise<AiChatMessage[] | null> {
    try {
      const raw = await this.redis.readAiMemory(
        KEYS.WINDOW(conversationId),
        KEYS.MARKER(conversationId)
      );
      if (raw === null) return null;

      return raw.map((item) => JSON.parse(item) as AiChatMessage);
    } catch (err) {
      this.logWarning('okunamadı', conversationId, err);
      return null;
    }
  }

  async warm(payload: WarmAiMemoryPayload): Promise<void> {
    const windowKey = KEYS.WINDOW(payload.conversationId);
    const markerKey = KEYS.MARKER(payload.conversationId);
    const items = payload.history
      .slice(-this.windowSize)
      .map((message) => JSON.stringify(message));

    try {
      // Tek MULTI: yarı yazılmış bir pencere okunamaz.
      const tx = this.redis.multi().del(windowKey);
      if (items.length > 0) {
        tx.rpush(windowKey, ...items).expire(windowKey, this.ttlSeconds);
      }
      await tx.set(markerKey, '1', 'EX', this.ttlSeconds).exec();
    } catch (err) {
      this.logWarning('ısıtılamadı', payload.conversationId, err);
    }
  }

  async append(payload: AppendAiMemoryPayload): Promise<void> {
    try {
      await this.redis.appendAiMemory(
        KEYS.WINDOW(payload.conversationId),
        KEYS.MARKER(payload.conversationId),
        JSON.stringify(payload.message),
        this.windowSize.toString(),
        this.ttlSeconds.toString()
      );
    } catch (err) {
      this.logWarning('güncellenemedi', payload.conversationId, err);
    }
  }

  async clear(conversationId: string): Promise<void> {
    try {
      await this.redis.del(
        KEYS.WINDOW(conversationId),
        KEYS.MARKER(conversationId)
      );
    } catch (err) {
      this.logWarning('temizlenemedi', conversationId, err);
    }
  }

  private logWarning(action: string, conversationId: string, err: unknown) {
    const reason = err instanceof Error ? err.message : 'Bilinmeyen hata';
    this.logger.warn(
      `AI bağlam penceresi ${action} (conversationId=${conversationId}): ${reason}`
    );
  }
}
