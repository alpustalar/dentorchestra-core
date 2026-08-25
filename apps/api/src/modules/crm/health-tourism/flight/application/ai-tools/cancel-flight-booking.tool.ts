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
import { CancelFlightBookingCommand } from '@modules/crm/health-tourism/flight/application/commands/cancel-flight-booking/cancel-flight-booking.command';
import { CancelFlightBookingDto } from '@shared/modules/health-tourism/dto/commands';

const CancelFlightBookingInputSchema = z.object({
  bookingId: z.string().trim().min(1),
});

/** Yazışmaya bağlı kişinin KENDİ uçuş rezervasyonunu iptal eder (sahiplik doğrulamalı). */
@AiTool()
@Injectable()
export class CancelFlightBookingTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.CANCEL_FLIGHT_BOOKING;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.CANCEL_FLIGHT_BOOKING,
      description:
        "Yazışmadaki hastanın/lead'in KENDİ uçuş rezervasyonunu iptal eder ve ödemesini otomatik iade başlatır. bookingId için önce get_flight_bookings ile rezervasyonu bul. Yalnızca bu yazışmaya bağlı kişinin rezervasyonu iptal edilebilir. UÇUŞ İPTALLERİNDE havayolu kesintisi yüksek olabilir ve bilet tipine göre iade hiç yapılmayabilir — iptal ÖNCESİ bunu mutlaka hatırlat ve onay al.",
      inputSchema: {
        type: 'object',
        properties: {
          bookingId: {
            type: 'string',
            description:
              "İptal edilecek uçuş rezervasyonunun id'si (get_flight_bookings çıktısındaki bookingId).",
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
    const parsed = CancelFlightBookingInputSchema.safeParse(input);
    if (!parsed.success) {
      return { content: 'İptal için geçerli bir rezervasyon kimliği gerekli.' };
    }
    const { bookingId } = parsed.data;

    if (!context.patientId && !context.leadId) {
      return { content: 'Bu rezervasyonu adınıza doğrulayamadım.' };
    }

    const items = await this.support.loadOwnedFlightBookings(context);
    const owned = items.find((b) => b.id === bookingId);
    if (!owned) {
      return {
        content:
          'Bu rezervasyonu adınıza doğrulayamadım; yalnızca size ait rezervasyonu iptal edebilirim.',
      };
    }

    const dto: CancelFlightBookingDto = {
      bookingId,
      reason: 'Hasta talebiyle iptal edildi.',
    } as CancelFlightBookingDto;

    await this.commandBus.execute(new CancelFlightBookingCommand(dto, ctx));

    const refunded = await this.support.refundForCancelledBooking(owned.id);

    return {
      content: JSON.stringify({
        success: true,
        message: refunded
          ? 'Uçuş rezervasyonunuz iptal edildi ve ödemeniz iade sürecine alındı. Havayolu kesintisi düşülebilir.'
          : 'Uçuş rezervasyonunuz iptal edildi. Ödeme iadeniz için ekibimiz sizinle iletişime geçecek.',
      }),
    };
  }
}
