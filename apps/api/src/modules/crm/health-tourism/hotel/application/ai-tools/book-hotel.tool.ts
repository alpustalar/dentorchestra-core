import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import {
  AI_TOOL_NAMES,
  AiTool,
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
  IAiSubToolHandler,
} from '@common/ai-tools';
import { AiToolSupport } from '@modules/platform/ai-tools/application/ai-tool.support';
import { GetHotelRateOptionQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-rate-option/get-hotel-rate-option.query';
import { HotelRateOptionToken } from '@modules/crm/health-tourism/hotel/domain/contracts';
import { InitiateBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.command';
import { HotelBookingIntent } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

interface HotelPax {
  roomId: number;
  type: 'AD' | 'CH';
  name: string;
  surname: string;
  age?: number;
}

const BookHotelInputSchema = z.object({
  optionId: z.string().trim().min(1),
  holderName: z.string().trim().min(1),
  holderSurname: z.string().trim().min(1),
});

/**
 * Seçilen otel seçeneği (optionId → cache'teki rateKey) için ÖDEME-ÖNCE tahsilat başlatır.
 * Rezervasyon HEMEN açılmaz; iki ödeme linki (iyzico TRY + Stripe EUR/USD) üretilir, hasta
 * birini ödeyince webhook rezervasyonu otomatik oluşturur (klinik maliyeti + iptal riski önlenir).
 */
@AiTool()
@Injectable()
export class BookHotelTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.BOOK_HOTEL;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.BOOK_HOTEL,
      description:
        "Seçilen otel için ÖDEME başlatır ve hastaya gönderilecek İKİ ödeme linki döner: tryLink (TRY, iyzico — Türkiye'den) ve fxLink (EUR/USD, Stripe — yurt dışından). Rezervasyon ancak ödeme alınınca otomatik oluşur (bu araç rezervasyonu HEMEN oluşturmaz). Yalnızca hastadan açık onay + iptal koşulları onayı aldıktan sonra çağır. optionId search_hotels çıktısından olmalı (~15 dk geçerli). Dönen iki linki de hastaya ilet: Türkiye'den ödeyecekse TRY linkini, yurt dışından ödeyecekse EUR/USD linkini kullanmasını söyle.",
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description:
              'Rezerve edilecek otel seçeneği (search_hotels çıktısından).',
          },
          holderName: {
            type: 'string',
            description: 'Rezervasyon sahibinin adı.',
          },
          holderSurname: {
            type: 'string',
            description: 'Rezervasyon sahibinin soyadı.',
          },
        },
        required: ['optionId', 'holderName', 'holderSurname'],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const parsed = BookHotelInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content: 'Rezervasyon için seçenek (optionId) ve ad soyad gerekli.',
      };
    }
    const { optionId, holderName, holderSurname } = parsed.data;

    const { data: option } = await this.queryBus.execute(
      new GetHotelRateOptionQuery(optionId, {
        clinicId: context.clinicId,
        conversationId: context.conversationId,
      })
    );
    if (!option) {
      return {
        content:
          'Bu fiyat seçeneğinin süresi doldu. Lütfen tekrar arama yapın.',
      };
    }

    const paxes = this.buildHotelPaxes(option, {
      name: holderName,
      surname: holderSurname,
    });

    const intent: HotelBookingIntent = {
      type: 'HOTEL',
      hotelCode: option.hotelCode,
      hotelName: option.hotelName,
      checkIn: option.checkIn,
      checkOut: option.checkOut,
      holderName,
      holderSurname,
      rooms: [{ rateKey: option.rateKey, paxes }],
    };

    const payment = await this.commandBus.execute(
      new InitiateBookingPaymentCommand({
        bookingType: 'HOTEL',
        intent,
        netAmount: option.net,
        netCurrency: option.currency as CurrencyType,
        buyer: {
          name: holderName,
          surname: holderSurname,
          email: '',
          phone: context.contactPhone ?? '',
        },
        clinicId: context.clinicId,
        organizationId: context.organizationId,
        patientId: context.patientId ?? null,
        leadId: context.patientId ? null : (context.leadId ?? null),
        conversationId: context.conversationId,
        ip: '127.0.0.1',
      })
    );

    return this.support.renderPaymentLinks(
      payment,
      `${option.hotelName} — ${option.checkIn} → ${option.checkOut}`
    );
  }

  /** Tek odalı pax listesi: ilk yetişkin = rezervasyon sahibi; kalanlar aynı soyadla doldurulur. */
  private buildHotelPaxes(
    option: HotelRateOptionToken,
    holder: { name: string; surname: string }
  ): HotelPax[] {
    const paxes: HotelPax[] = [];
    for (let i = 0; i < option.adults; i++) {
      paxes.push({
        roomId: 1,
        type: 'AD',
        name: i === 0 ? holder.name : 'Misafir',
        surname: holder.surname,
      });
    }
    for (let i = 0; i < option.children; i++) {
      paxes.push({
        roomId: 1,
        type: 'CH',
        name: 'Çocuk',
        surname: holder.surname,
        age: 8,
      });
    }
    return paxes;
  }
}
