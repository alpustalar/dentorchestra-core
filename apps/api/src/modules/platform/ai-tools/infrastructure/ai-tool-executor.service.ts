import { Injectable, Logger } from '@nestjs/common';
import {
  AiToolCall,
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
  IAiToolExecutor,
} from '@common/ai-tools';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { AiToolRegistry } from './ai-tool.registry';

/**
 * AI araçlarının ince orkestratörü (Dispatcher). Tool mantığı burada YAŞAMAZ — her araç
 * kendi strateji sınıfında (handlers/). Bu sınıf yalnız: registry'den aracı çözer,
 * çalıştırır, hataları tek yerde sarmalar ve LLM tanımlarını aktarır. Yeni araç eklemek
 * bu dosyaya dokunmaz (Open/Closed).
 */
@Injectable()
export class AiToolExecutor implements IAiToolExecutor {
  private readonly logger = new Logger(AiToolExecutor.name);

  constructor(private readonly registry: AiToolRegistry) {}

  getToolDefinitions(): AiToolDefinition[] {
    return this.registry.definitions();
  }

  async execute(
    call: AiToolCall,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const tool = this.registry.resolve(call.name);
    if (!tool) {
      return { content: `Bilinmeyen araç: ${call.name}` };
    }

    try {
      return await tool.execute(call.input, context);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Bilinmeyen hata';
      this.logger.warn(`Araç çalıştırma hatası (${call.name}): ${reason}`);

      // Araç sonucu **hastaya** gider (AI onu yanıtına alır). Bu yüzden yalnız
      // domain hatasının mesajı aktarılır: o mesaj kullanıcı için yazılmıştır ve
      // tiplidir. Diğer her şey (DB/sağlayıcı/kütüphane hatası) iç ayrıntı taşır —
      // bağlantı dizgesi, tablo adı, sağlayıcı yanıtı — ve hasta kanalına
      // kopyalanmamalı; gerçek sebep log'da durur.
      const safeReason =
        err instanceof DomainException
          ? err.message
          : 'Teknik bir sorun oluştu, lütfen daha sonra tekrar deneyin.';

      return {
        content: `Bu işlem şu anda gerçekleştirilemedi: ${safeReason}`,
      };
    }
  }
}
