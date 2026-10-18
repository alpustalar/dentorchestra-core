import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  AI_TOOL_NAMES,
  AiTool,
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
  IAiSubToolHandler,
} from '@common/ai-tools';
import { AiToolSupport } from '@modules/platform/ai-tools/application/ai-tool.support';
import { SearchHotelsQuery } from '@modules/crm/health-tourism/hotel/application/queries/search-hotels/search-hotels.query';
import { SearchHotelsDto } from '@shared/modules/health-tourism/dto/queries';
import { CacheHotelRateOptionCommand } from '@modules/crm/health-tourism/hotel/application/commands/cache-hotel-rate-option/cache-hotel-rate-option.command';
import { HotelRateOptionToken } from '@modules/crm/health-tourism/hotel/domain/contracts';
import { QuoteOptionOwner } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

const SearchHotelsInputSchema = z.object({
  checkIn: z.string().trim().min(1),
  checkOut: z.string().trim().min(1),
  adults: z.number().positive().optional(),
  children: z.number().nonnegative().optional(),
  rooms: z.number().positive().optional(),
});

/**
 * Klinik çevresindeki anlaşmalı otellerde müsaitlik arar. Kapsam config'ten gelir:
 * allowlist (nearbyHotelCodes) öncelikli, yoksa şehir destinationCode. Her rate için kısa
 * optionId üretip rateKey'i cache'e mühürler (LLM opak rateKey taşımaz — B1).
 */
@AiTool()
@Injectable()
export class SearchHotelsTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.SEARCH_HOTELS;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.SEARCH_HOTELS,
      description:
        "Klinik çevresindeki anlaşmalı otellerde verilen tarihler ve kişi sayısı için müsait oda/fiyat seçeneklerini döner. Hangi otellerin aranacağı klinik ayarından otomatik gelir (sen otel/şehir belirtme). Her seçeneğin kısa bir optionId'si olur; rezervasyon için book_hotel'e o optionId'yi ver. Tarihleri YYYY-MM-DD ver.",
      inputSchema: {
        type: 'object',
        properties: {
          checkIn: {
            type: 'string',
            description: 'Giriş tarihi (YYYY-MM-DD).',
          },
          checkOut: {
            type: 'string',
            description: 'Çıkış tarihi (YYYY-MM-DD).',
          },
          adults: { type: 'number', description: 'Yetişkin sayısı (en az 1).' },
          children: { type: 'number', description: 'Çocuk sayısı (yoksa 0).' },
          rooms: { type: 'number', description: 'Oda sayısı (belirsizse 1).' },
        },
        required: ['checkIn', 'checkOut', 'adults'],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const ctx = this.support.buildClinicContext(context);
    const config = await this.support.getHealthTourismConfig(context);
    if (!config || !config.isEnabled) {
      return {
        content: 'Bu klinikte otel rezervasyon hizmeti şu anda aktif değil.',
      };
    }

    // Allowlist öncelikli hibrit kapsam (B0 kararı).
    const hotelCodes =
      config.nearbyHotelCodes.length > 0 ? config.nearbyHotelCodes : undefined;
    const destinationCode = hotelCodes
      ? undefined
      : (config.destinationCode ?? undefined);
    if (!hotelCodes && !destinationCode) {
      return { content: 'Otel araması için klinik henüz yapılandırılmamış.' };
    }

    const parsed = SearchHotelsInputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: 'Otel araması için giriş ve çıkış tarihi gerekli.' };
    }
    const { checkIn, checkOut } = parsed.data;
    const adults = parsed.data.adults ?? 1;
    const children = parsed.data.children ?? 0;
    const rooms = parsed.data.rooms ?? 1;

    const dto: SearchHotelsDto = {
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      occupancies: [{ rooms, adults, children }],
      destinationCode,
      hotelCodes,
    } as SearchHotelsDto;

    const { data: hotels } = await this.queryBus.execute(
      new SearchHotelsQuery(dto, ctx)
    );

    // Teklifin sahibi: bu kiracı + bu görüşme. Okuma anında doğrulanır
    // (`QuoteOptionOwnershipService`) — önbellek anahtarı yetki değildir.
    const owner: QuoteOptionOwner = {
      clinicId: context.clinicId,
      conversationId: context.conversationId,
    };

    // Tüm otel/oda/rate kombinasyonlarını düzleştir, ucuzdan pahalıya sırala.
    const tokens: HotelRateOptionToken[] = [];
    for (const hotel of hotels) {
      for (const room of hotel.rooms) {
        for (const rate of room.rates) {
          tokens.push({
            owner,
            hotelCode: hotel.code,
            hotelName: hotel.name,
            roomName: room.name ?? room.code,
            boardName: rate.boardName ?? rate.boardCode,
            rateKey: rate.rateKey,
            checkIn,
            checkOut,
            net: rate.net,
            currency: rate.currency,
            adults,
            children,
          });
        }
      }
    }

    tokens.sort((a, b) => a.net - b.net);
    const top = tokens.slice(0, 6);
    if (top.length === 0) {
      return { content: 'Verilen tarihler için uygun otel/oda bulunamadı.' };
    }

    const options: Array<{
      optionId: string;
      hotel: string;
      room: string;
      board: string;
      totalPrice: number;
      currency: string;
    }> = [];
    for (const token of top) {
      // Kısaltma YOK: 8 hex (32 bit) bir optionId, aynı 15 dakikada yaşayan
      // binlerce teklif arasında çarpışabilir ve çarpışma **üzerine yazar** —
      // hasta gördüğü odayı öder, sistem başka odayı rezerve eder.
      const optionId = `ht_${randomUUID()}`;
      await this.commandBus.execute(
        new CacheHotelRateOptionCommand(optionId, token)
      );
      options.push({
        optionId,
        hotel: token.hotelName,
        room: token.roomName,
        board: token.boardName,
        totalPrice: token.net,
        currency: token.currency,
      });
    }

    return { content: JSON.stringify({ checkIn, checkOut, options }) };
  }
}
