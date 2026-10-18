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
import { SearchTransferAvailabilityQuery } from '@modules/crm/health-tourism/transfer/application/queries/search-transfer-availability/search-transfer-availability.query';
import { SearchTransferAvailabilityDto } from '@shared/modules/health-tourism/dto/queries';
import { CacheTransferRateOptionCommand } from '@modules/crm/health-tourism/transfer/application/commands/cache-transfer-rate-option/cache-transfer-rate-option.command';
import { TransferRateOptionToken } from '@modules/crm/health-tourism/transfer/domain/contracts/hotelbeds-transfer-booking';
import { QuoteOptionOwner } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

const SearchTransfersInputSchema = z.object({
  direction: z.enum(['ARRIVAL', 'DEPARTURE']).optional(),
  date: z.string().trim().min(1),
  time: z.string().trim().min(1),
  adults: z.number().positive().optional(),
  children: z.number().nonnegative().optional(),
  infants: z.number().nonnegative().optional(),
});

/**
 * Havalimanı ↔ klinik transfer seçeneklerini arar. Nereden/nereye config'ten gelir:
 * ARRIVAL = havalimanı(IATA) → klinik(ATLAS/GPS), DEPARTURE tersi. Her rate için kısa
 * optionId üretip rateKey'i cache'e mühürler (LLM opak rateKey taşımaz).
 */
@AiTool()
@Injectable()
export class SearchTransfersTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.SEARCH_TRANSFERS;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.SEARCH_TRANSFERS,
      description:
        "Havalimanı ile klinik arasında transfer (araç) seçeneklerini döner. Nereden/nereye klinik ayarından otomatik gelir; sen yön (geliş/gidiş), tarih, saat ve kişi sayısı sor. ARRIVAL = havalimanından kliniğe (uçuş indikten sonra), DEPARTURE = klinikten havalimanına. Her seçeneğin kısa optionId'si olur; book_transfer'e onu ver. Tarih YYYY-MM-DD, saat HH:mm.",
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['ARRIVAL', 'DEPARTURE'],
            description:
              'ARRIVAL: havalimanı → klinik. DEPARTURE: klinik → havalimanı.',
          },
          date: {
            type: 'string',
            description:
              'Transfer tarihi (YYYY-MM-DD). ARRIVAL için uçağın iniş tarihi.',
          },
          time: {
            type: 'string',
            description:
              'Transfer saati (HH:mm). ARRIVAL için uçağın iniş saati.',
          },
          adults: { type: 'number', description: 'Yetişkin sayısı (en az 1).' },
          children: { type: 'number', description: 'Çocuk sayısı (yoksa 0).' },
          infants: { type: 'number', description: 'Bebek sayısı (yoksa 0).' },
        },
        required: ['direction', 'date', 'time', 'adults'],
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
      return { content: 'Bu klinikte transfer hizmeti şu anda aktif değil.' };
    }
    if (
      !config.airportIata ||
      !config.clinicLocationType ||
      !config.clinicLocationCode
    ) {
      return { content: 'Transfer için klinik henüz yapılandırılmamış.' };
    }

    const parsed = SearchTransfersInputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: 'Transfer araması için tarih ve saat gerekli.' };
    }
    const direction = parsed.data.direction ?? 'ARRIVAL';
    const isArrival = direction === 'ARRIVAL';
    const airport = { type: 'IATA', code: config.airportIata };
    const clinic = {
      type: config.clinicLocationType,
      code: config.clinicLocationCode,
    };
    const from = isArrival ? airport : clinic;
    const to = isArrival ? clinic : airport;

    const adults = parsed.data.adults ?? 1;
    const children = parsed.data.children ?? 0;
    const infants = parsed.data.infants ?? 0;

    const dto: SearchTransferAvailabilityDto = {
      language: 'en',
      fromType: from.type,
      fromCode: from.code,
      toType: to.type,
      toCode: to.code,
      outboundDate: parsed.data.date,
      outboundTime: parsed.data.time,
      adults,
      children,
      infants,
    } as SearchTransferAvailabilityDto;

    const { data: items } = await this.queryBus.execute(
      new SearchTransferAvailabilityQuery(dto, ctx)
    );

    const sorted = [...items].sort(
      (a, b) => a.price.totalAmount - b.price.totalAmount
    );
    const top = sorted.slice(0, 6);
    if (top.length === 0) {
      return { content: 'Verilen tarih/saat için uygun transfer bulunamadı.' };
    }

    // Teklifin sahibi: bu kiracı + bu görüşme. Okuma anında doğrulanır
    // (`QuoteOptionOwnershipService`) — önbellek anahtarı yetki değildir.
    const owner: QuoteOptionOwner = {
      clinicId: context.clinicId,
      conversationId: context.conversationId,
    };

    const options: Array<{
      optionId: string;
      vehicle: string;
      category: string;
      price: number;
      currency: string;
    }> = [];
    for (const item of top) {
      // Kısaltma YOK — gerekçe `search_hotels` ile aynı (çarpışma üzerine yazar).
      const optionId = `tr_${randomUUID()}`;
      const token: TransferRateOptionToken = {
        owner,
        rateKey: item.rateKey,
        direction,
        vehicleName: item.vehicle.name,
        categoryName: item.category.name,
        totalAmount: item.price.totalAmount,
        currency: item.price.currencyId,
        fromCode: from.code,
        toCode: to.code,
      };
      await this.commandBus.execute(
        new CacheTransferRateOptionCommand(optionId, token)
      );
      options.push({
        optionId,
        vehicle: item.vehicle.name,
        category: item.category.name,
        price: item.price.totalAmount,
        currency: item.price.currencyId,
      });
    }

    return { content: JSON.stringify({ direction, options }) };
  }
}
