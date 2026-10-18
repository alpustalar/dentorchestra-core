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
import { GetTransferRateOptionQuery } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-rate-option/get-transfer-rate-option.query';
import { InitiateBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.command';
import { TransferBookingIntent } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

const BookTransferInputSchema = z.object({
  optionId: z.string().trim().min(1),
  holderName: z.string().trim().min(1),
  holderSurname: z.string().trim().min(1),
  holderEmail: z.string().trim().min(1),
  holderPhone: z.string().trim().min(1),
  flightCode: z.string().trim().min(1),
});

/**
 * Seçilen transfer seçeneği (optionId → cache'teki rateKey) için ÖDEME-ÖNCE tahsilat başlatır.
 * Uçuş kodu + e-posta + telefon zorunlu. Rezervasyon HEMEN açılmaz; iki ödeme linki üretilir,
 * ödeme onaylanınca webhook rezervasyonu otomatik oluşturur.
 */
@AiTool()
@Injectable()
export class BookTransferTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.BOOK_TRANSFER;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.BOOK_TRANSFER,
      description:
        "Seçilen transfer için ÖDEME başlatır ve hastaya gönderilecek İKİ ödeme linki döner: tryLink (TRY, iyzico — Türkiye'den) ve fxLink (EUR/USD, Stripe — yurt dışından). Rezervasyon ancak ödeme alınınca otomatik oluşur (bu araç rezervasyonu HEMEN oluşturmaz). Yalnızca hastadan açık onay + iptal koşulları onayı aldıktan sonra çağır. optionId search_transfers çıktısından gelir (~15 dk geçerli). Uçuş numarası (flightCode), e-posta ve telefon zorunludur. Dönen iki linki de hastaya ilet (Türkiye'den TRY/iyzico, yurt dışından EUR-USD/Stripe).",
      inputSchema: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description:
              'Rezerve edilecek transfer seçeneği (search_transfers çıktısından).',
          },
          holderName: {
            type: 'string',
            description: 'Rezervasyon sahibinin adı.',
          },
          holderSurname: {
            type: 'string',
            description: 'Rezervasyon sahibinin soyadı.',
          },
          holderEmail: {
            type: 'string',
            description: 'Rezervasyon sahibinin e-posta adresi (zorunlu).',
          },
          holderPhone: {
            type: 'string',
            description: 'Rezervasyon sahibinin telefon numarası (zorunlu).',
          },
          flightCode: {
            type: 'string',
            description:
              'Uçuş numarası (ör. "TK1980"). ARRIVAL için iniş, DEPARTURE için kalkış uçuşu.',
          },
        },
        required: [
          'optionId',
          'holderName',
          'holderSurname',
          'holderEmail',
          'holderPhone',
          'flightCode',
        ],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const parsed = BookTransferInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content:
          'Transfer rezervasyonu için seçenek, ad soyad, e-posta, telefon ve uçuş numarası gerekli.',
      };
    }
    const {
      optionId,
      holderName,
      holderSurname,
      holderEmail,
      holderPhone,
      flightCode,
    } = parsed.data;

    const { data: option } = await this.queryBus.execute(
      new GetTransferRateOptionQuery(optionId, {
        clinicId: context.clinicId,
        conversationId: context.conversationId,
      })
    );
    if (!option) {
      return {
        content:
          'Bu transfer seçeneğinin süresi doldu. Lütfen tekrar arama yapın.',
      };
    }

    const intent: TransferBookingIntent = {
      type: 'TRANSFER',
      language: 'en',
      vehicleName: option.vehicleName,
      holderName,
      holderSurname,
      holderEmail,
      holderPhone,
      transfers: [
        {
          rateKey: option.rateKey,
          transferDetails: [
            { type: 'FLIGHT', direction: option.direction, code: flightCode },
          ],
        },
      ],
    };

    const payment = await this.commandBus.execute(
      new InitiateBookingPaymentCommand({
        bookingType: 'TRANSFER',
        intent,
        netAmount: option.totalAmount,
        netCurrency: option.currency as CurrencyType,
        buyer: {
          name: holderName,
          surname: holderSurname,
          email: holderEmail,
          phone: holderPhone,
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
      `Transfer — ${option.vehicleName}`
    );
  }
}
