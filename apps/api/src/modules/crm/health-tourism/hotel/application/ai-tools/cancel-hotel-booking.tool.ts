import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  AI_TOOL_NAMES,
  AiTool,
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
  IAiSubToolHandler,
} from '@common/ai-tools';
import { AiToolSupport } from '@modules/platform/ai-tools/application/ai-tool.support';
import { CancelHotelBookingCommand } from '@modules/crm/health-tourism/hotel/application/commands/cancel-hotel-booking/cancel-hotel-booking.command';
import { CancelHotelBookingDto } from '@shared/modules/health-tourism/dto/commands';

const CancelHotelBookingInputSchema = z.object({
  bookingId: z.string().trim().min(1),
});

/** Yazışmaya bağlı kişinin KENDİ otel rezervasyonunu iptal eder (sahiplik doğrulamalı). */
@AiTool()
@Injectable()
export class CancelHotelBookingTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.CANCEL_HOTEL_BOOKING;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.CANCEL_HOTEL_BOOKING,
      description:
        "Yazışmadaki hastanın/lead'in KENDİ otel rezervasyonunu iptal eder ve ödemesini otomatik iade başlatır. bookingId için önce get_hotel_bookings ile rezervasyonu bul. Yalnızca bu yazışmaya bağlı kişinin rezervasyonu iptal edilebilir. İptal koşullarına göre ücret doğabileceğini iptal ÖNCESİ hatırlat.",
      inputSchema: {
        type: 'object',
        properties: {
          bookingId: {
            type: 'string',
            description:
              'İptal edilecek rezervasyonun kimliği (get_hotel_bookings çıktısındaki id).',
          },
        },
        required: ['bookingId'],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const ctx = this.support.buildClinicContext(context);
    const parsed = CancelHotelBookingInputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: 'İptal için geçerli bir rezervasyon kimliği gerekli.' };
    }
    const { bookingId } = parsed.data;
    if (!context.patientId && !context.leadId) {
      return { content: 'Bu rezervasyonu adınıza doğrulayamadım.' };
    }

    const { data: owned } = await this.support.loadOwnedHotelBookings(context);
    if (!owned.some((b) => b.id === bookingId)) {
      return {
        content:
          'Bu rezervasyonu adınıza doğrulayamadım; yalnızca size ait rezervasyonu iptal edebilirim.',
      };
    }

    const cancelDto: CancelHotelBookingDto = {
      bookingId,
    } as CancelHotelBookingDto;
    const cancellation = await this.commandBus.execute(
      new CancelHotelBookingCommand(cancelDto, ctx)
    );

    const refunded = await this.support.refundForCancelledBooking({
      bookingId,
      retained: cancellation.retained,
    });

    return {
      content: JSON.stringify({
        success: true,
        message: refunded
          ? 'Otel rezervasyonunuz iptal edildi ve ödemeniz iade ediliyor.'
          : 'Otel rezervasyonunuz iptal edildi. Ödeme iadeniz için ekibimiz sizinle iletişime geçecek.',
      }),
    };
  }
}
