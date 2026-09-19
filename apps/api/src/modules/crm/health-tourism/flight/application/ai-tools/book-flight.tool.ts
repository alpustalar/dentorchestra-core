import { Injectable, Logger } from '@nestjs/common';
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
import { GetFlightOfferQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-offer/get-flight-offer.query';
import { HoldFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/hold-flight/hold-flight.command';
import { InitiateBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.command';
import type {
  FlightBookingIntent,
  FlightIntentPassenger,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import type { BookFlight } from '@shared/modules/health-tourism/types/commands';
import type { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';
import type { IGetContext } from '@common/decorators';

const PassengerSchema = z.object({
  type: z.enum(['adult', 'child', 'infant_without_seat']).optional(),
  title: z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']).optional(),
  givenName: z.string().trim().min(1),
  familyName: z.string().trim().min(1),
  bornOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['m', 'f']).optional(),
});

const BookFlightInputSchema = z.object({
  optionId: z.string().trim().min(1),
  passengers: z.array(PassengerSchema).min(1),
  contactEmail: z.string().trim().min(1),
  contactPhone: z.string().trim().min(1),
});

/** 2'den fazla parametre → obje; tip dışarıda tanımlı (parametre sayısı kuralı). */
interface BuildFlightIntentArgs {
  option: FlightOfferToken;
  optionId: string;
  passengers: FlightIntentPassenger[];
  contactEmail: string;
  contactPhone: string;
  context: AiToolContext;
  ctx: IGetContext;
}

/**
 * Seçilen uçuş için ÖDEME-ÖNCE tahsilat başlatır — hibrit akışın karar noktası.
 *
 * Teklif hold'a uygunsa (`requiresInstantPayment === false`) koltuk **önce**
 * Duffel'da tutulur, sonra ödeme linki üretilir: hasta öderken uçuş dolmaz.
 * Uygun değilse teklif cache'te bekletilir ve sipariş ancak ödeme onayında açılır.
 */
@AiTool()
@Injectable()
export class BookFlightTool implements IAiSubToolHandler {
  private readonly logger = new Logger(BookFlightTool.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.BOOK_FLIGHT;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.BOOK_FLIGHT,
      description:
        "Seçilen uçuş için ÖDEME başlatır ve hastaya gönderilecek İKİ ödeme linki döner: tryLink (TRY, iyzico — Türkiye'den) ve fxLink (EUR/USD, Stripe — yurt dışından). Bilet ancak ödeme alınınca kesilir (bu araç bileti HEMEN kesmez). Yalnızca hastadan açık onay aldıktan sonra çağır. optionId search_flights çıktısından gelir. HER YOLCU için ad, soyad ve doğum tarihi zorunludur — havayolu bileti kimlik bilgisi olmadan kesilemez; isimler pasaporttaki gibi yazılmalıdır, sonradan değiştirmek ücretlidir veya imkânsızdır. Dönen iki linki de hastaya ilet.",
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description:
              'Rezerve edilecek uçuş seçeneği (search_flights çıktısından).',
          },
          passengers: {
            type: 'array',
            description:
              'Yolcu listesi. Sayısı aramadaki yolcu sayısıyla aynı olmalı.',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['adult', 'child', 'infant_without_seat'],
                  description: 'Yolcu tipi. Belirtilmezse adult.',
                },
                title: {
                  type: 'string',
                  enum: ['mr', 'ms', 'mrs', 'miss', 'dr'],
                  description: 'Hitap.',
                },
                givenName: {
                  type: 'string',
                  description: 'Yolcunun adı (pasaporttaki gibi).',
                },
                familyName: {
                  type: 'string',
                  description: 'Yolcunun soyadı (pasaporttaki gibi).',
                },
                bornOn: {
                  type: 'string',
                  description: 'Doğum tarihi (YYYY-MM-DD).',
                },
                gender: {
                  type: 'string',
                  enum: ['m', 'f'],
                  description: 'Cinsiyet.',
                },
              },
              required: ['givenName', 'familyName', 'bornOn'],
              additionalProperties: false,
            },
          },
          contactEmail: {
            type: 'string',
            description: 'İletişim e-postası (zorunlu).',
          },
          contactPhone: {
            type: 'string',
            description: 'İletişim telefonu (zorunlu).',
          },
        },
        required: ['optionId', 'passengers', 'contactEmail', 'contactPhone'],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const parsed = BookFlightInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content:
          'Uçuş rezervasyonu için seçenek, her yolcunun adı/soyadı/doğum tarihi, e-posta ve telefon gerekli.',
      };
    }

    const { optionId, passengers, contactEmail, contactPhone } = parsed.data;

    const { data: option } = await this.queryBus.execute(
      new GetFlightOfferQuery(optionId)
    );
    if (!option) {
      return {
        content:
          'Bu uçuş seçeneğinin süresi doldu. Lütfen tekrar arama yapın (uçuş fiyatları hızla değişir).',
      };
    }

    const normalizedPassengers: FlightIntentPassenger[] = passengers.map(
      (p) => ({
        type: p.type ?? 'adult',
        title: p.title,
        givenName: p.givenName,
        familyName: p.familyName,
        bornOn: p.bornOn,
        gender: p.gender,
      })
    );

    const ctx = this.support.buildClinicContext(context);
    const intent = await this.buildIntent({
      option,
      optionId,
      passengers: normalizedPassengers,
      contactEmail,
      contactPhone,
      context,
      ctx,
    });

    const payment = await this.commandBus.execute(
      new InitiateBookingPaymentCommand({
        bookingType: 'FLIGHT',
        intent,
        netAmount: option.totalAmount,
        netCurrency: option.currency,
        buyer: {
          name: normalizedPassengers[0].givenName,
          surname: normalizedPassengers[0].familyName,
          email: contactEmail,
          phone: contactPhone,
        },
        clinicId: context.clinicId,
        organizationId: context.organizationId,
        patientId: context.patientId ?? null,
        leadId: context.patientId ? null : (context.leadId ?? null),
        conversationId: context.conversationId,
        ip: '127.0.0.1',
      })
    );

    return this.support.renderPaymentLinks(payment, `Uçuş — ${option.summary}`);
  }

  /**
   * Hibrit karar. Hold denemesi başarısız olursa akış durmaz: instant yola düşülür
   * (koltuk tutulamamış olur ama hasta yine de ödeme linkini alır).
   */
  private async buildIntent(
    args: BuildFlightIntentArgs
  ): Promise<FlightBookingIntent> {
    const {
      option,
      optionId,
      passengers,
      contactEmail,
      contactPhone,
      context,
      ctx,
    } = args;

    const instantIntent: FlightBookingIntent = {
      type: 'FLIGHT',
      mode: 'INSTANT',
      optionId,
      clinicId: context.clinicId,
      passengers,
      contactEmail,
      contactPhone,
      summary: option.summary,
    };

    if (option.requiresInstantPayment) return instantIntent;

    try {
      const held = await this.commandBus.execute(
        new HoldFlightCommand(
          {
            optionId,
            passengers,
            contactEmail,
            contactPhone,
            clinicId: context.clinicId,
            patientId: context.patientId ?? undefined,
            leadId: context.patientId
              ? undefined
              : (context.leadId ?? undefined),
            manualOverride: false,
          } as BookFlight,
          ctx
        )
      );

      return {
        type: 'FLIGHT',
        mode: 'HOLD',
        flightBookingId: held.bookingId,
        duffelOrderId: held.duffelOrderId,
        summary: option.summary,
      };
    } catch (error) {
      // Koltuk tutulamadı — hasta yine de ödeyebilsin diye instant yola düşülür.
      this.logger.warn(
        `Uçuş koltuğu tutulamadı, instant ödeme yoluna düşülüyor (option=${optionId}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return instantIntent;
    }
  }
}
