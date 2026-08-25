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
import { SearchFlightOffersQuery } from '@modules/crm/health-tourism/flight/application/queries/search-flight-offers/search-flight-offers.query';
import { CacheFlightOfferCommand } from '@modules/crm/health-tourism/flight/application/commands/cache-flight-offer/cache-flight-offer.command';
import {
  FlightOffer,
  FlightOfferToken,
} from '@modules/crm/health-tourism/flight/domain/contracts';
import { SearchFlightsDto } from '@shared/modules/health-tourism/dto/queries';

const SearchFlightsInputSchema = z.object({
  origin: z.string().trim().length(3),
  departureDate: z.string().trim().min(1),
  returnDate: z.string().trim().min(1).optional(),
  adults: z.number().positive().optional(),
  children: z.number().nonnegative().optional(),
  infants: z.number().nonnegative().optional(),
  cabinClass: z
    .enum(['economy', 'premium_economy', 'business', 'first'])
    .optional(),
});

/** LLM'e gösterilecek azami seçenek — liste uzadıkça model seçim yapamaz hale gelir. */
const MAX_SHOWN_OPTIONS = 6;

/** LLM'e dönen seçenek satırı — Duffel `offer_id` bilinçli olarak YOK. */
interface SearchedFlightOption {
  optionId: string;
  airline: string;
  summary: string;
  price: number;
  currency: string;
  stops: number;
}

/**
 * Hastanın bulunduğu şehirden kliniğin havalimanına uçuş arar.
 *
 * Varış havalimanı **klinik config'inden** gelir (transferdeki `airportIata`
 * deseninin aynısı); kalkış hastadan sorulur çünkü hasta her ülkeden gelebilir.
 * Her teklif için kısa `fl_` optionId üretilip Duffel `offer_id`'si cache'e
 * mühürlenir — opak sağlayıcı kimliği LLM'e hiç verilmez.
 */
@AiTool()
@Injectable()
export class SearchFlightsTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.SEARCH_FLIGHTS;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.SEARCH_FLIGHTS,
      description:
        "Hastanın bulunduğu şehirden kliniğin bulunduğu şehre uçuş seçeneklerini döner. Varış havalimanı klinik ayarından otomatik gelir; sen yalnız kalkış havalimanını (3 harfli IATA kodu), tarihleri ve yolcu sayısını sor. Dönüş tarihi verilirse gidiş-dönüş, verilmezse tek yön aranır. Her seçeneğin kısa optionId'si olur; book_flight'a onu ver. Fiyatlar hızla değişir: seçenekler yalnız birkaç dakika geçerlidir, hasta karar verirken gecikirse tekrar ara. Tarih formatı YYYY-MM-DD.",
      inputSchema: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description:
              'Kalkış havalimanının 3 harfli IATA kodu (ör. "FRA", "LHR"). Hastanın bulunduğu şehre en yakın havalimanı.',
          },
          departureDate: {
            type: 'string',
            description: 'Gidiş tarihi (YYYY-MM-DD).',
          },
          returnDate: {
            type: 'string',
            description:
              'Dönüş tarihi (YYYY-MM-DD). Tek yön isteniyorsa gönderme.',
          },
          adults: { type: 'number', description: 'Yetişkin sayısı (en az 1).' },
          children: { type: 'number', description: 'Çocuk sayısı (yoksa 0).' },
          infants: { type: 'number', description: 'Bebek sayısı (yoksa 0).' },
          cabinClass: {
            type: 'string',
            enum: ['economy', 'premium_economy', 'business', 'first'],
            description: 'Kabin sınıfı. Belirtilmezse economy.',
          },
        },
        required: ['origin', 'departureDate', 'adults'],
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
      return { content: 'Bu klinikte uçuş hizmeti şu anda aktif değil.' };
    }
    if (!config.airportIata) {
      return {
        content:
          'Uçuş araması için kliniğin varış havalimanı henüz tanımlanmamış.',
      };
    }

    const parsed = SearchFlightsInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content:
          'Uçuş araması için kalkış havalimanı (IATA), gidiş tarihi ve yolcu sayısı gerekli.',
      };
    }

    const filter = {
      origin: parsed.data.origin.toUpperCase(),
      destination: config.airportIata,
      departureDate: parsed.data.departureDate,
      returnDate: parsed.data.returnDate,
      adults: parsed.data.adults ?? 1,
      children: parsed.data.children ?? 0,
      infants: parsed.data.infants ?? 0,
      cabinClass: parsed.data.cabinClass ?? 'economy',
      clinicId: context.clinicId,
    } as SearchFlightsDto;

    const { data: offers } = await this.queryBus.execute(
      new SearchFlightOffersQuery(filter, ctx)
    );

    const top = [...offers]
      .sort((a, b) => a.totalAmount - b.totalAmount)
      .slice(0, MAX_SHOWN_OPTIONS);

    if (top.length === 0) {
      return {
        content: 'Verilen tarih ve güzergâh için uygun uçuş bulunamadı.',
      };
    }

    const options: SearchedFlightOption[] = [];
    for (const offer of top) {
      const optionId = `fl_${randomUUID().slice(0, 8)}`;
      const summary = buildSummary(offer);

      const token: FlightOfferToken = {
        offerId: offer.offerId,
        totalAmount: offer.totalAmount,
        currency: offer.currency,
        requiresInstantPayment: offer.requiresInstantPayment,
        paymentRequiredBy: offer.paymentRequiredBy,
        expiresAt: offer.expiresAt,
        ownerName: offer.ownerName,
        summary,
        originIata: offer.slices[0]?.originIata ?? filter.origin,
        destinationIata: offer.slices[0]?.destinationIata ?? filter.destination,
        departingAt: offer.slices[0]?.segments[0]?.departingAt ?? '',
        slices: offer.slices,
      };

      await this.commandBus.execute(
        new CacheFlightOfferCommand(optionId, token)
      );

      options.push({
        optionId,
        airline: offer.ownerName,
        summary,
        price: offer.totalAmount,
        currency: offer.currency,
        stops: Math.max(0, (offer.slices[0]?.segments.length ?? 1) - 1),
      });
    }

    return {
      content: JSON.stringify({
        origin: filter.origin,
        destination: filter.destination,
        departureDate: filter.departureDate,
        returnDate: filter.returnDate ?? null,
        options,
      }),
    };
  }
}

/** "TK1988 · FRA 09:15 → IST 13:05 (aktarmasız)" gibi okunur özet. */
function buildSummary(offer: FlightOffer): string {
  const first = offer.slices[0];
  if (!first || first.segments.length === 0) return offer.ownerName;

  const departure = first.segments[0];
  const arrival = first.segments[first.segments.length - 1];
  const stops = first.segments.length - 1;
  const stopLabel = stops === 0 ? 'aktarmasız' : `${stops} aktarma`;

  return `${departure.carrierIata}${departure.flightNumber ?? ''} · ${
    first.originIata
  } ${formatTime(departure.departingAt)} → ${first.destinationIata} ${formatTime(
    arrival.arrivingAt
  )} (${stopLabel})`;
}

/** ISO 8601 → "HH:mm" (havalimanı yerel saati; Duffel zaten yerel veriyor). */
function formatTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : '';
}
