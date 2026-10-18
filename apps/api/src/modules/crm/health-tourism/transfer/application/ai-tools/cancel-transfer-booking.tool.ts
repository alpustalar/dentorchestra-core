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
import { CancelTransferBookingCommand } from '@modules/crm/health-tourism/transfer/application/commands/cancel-transfer-booking/cancel-transfer-booking.command';
import { CancelTransferBookingDto } from '@shared/modules/health-tourism/dto/commands';

const CancelTransferBookingInputSchema = z.object({
  reference: z.string().trim().min(1),
});

/** Yazışmaya bağlı kişinin KENDİ transfer rezervasyonunu iptal eder (sahiplik doğrulamalı). */
@AiTool()
@Injectable()
export class CancelTransferBookingTool implements IAiSubToolHandler {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly support: AiToolSupport
  ) {}

  get name(): string {
    return AI_TOOL_NAMES.CANCEL_TRANSFER_BOOKING;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.CANCEL_TRANSFER_BOOKING,
      description:
        "Yazışmadaki hastanın/lead'in KENDİ transfer rezervasyonunu iptal eder ve ödemesini otomatik iade başlatır. reference için önce get_transfer_bookings ile rezervasyonu bul. Yalnızca bu yazışmaya bağlı kişinin rezervasyonu iptal edilebilir. İptal koşullarına göre ücret doğabileceğini iptal ÖNCESİ hatırlat.",
      inputSchema: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description:
              'İptal edilecek transfer rezervasyonunun referansı (get_transfer_bookings çıktısındaki reference).',
          },
        },
        required: ['reference'],
        additionalProperties: false,
      },
    };
  }

  async execute(
    input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    const ctx = this.support.buildClinicContext(context);
    const parsed = CancelTransferBookingInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content: 'İptal için geçerli bir rezervasyon referansı gerekli.',
      };
    }
    const { reference } = parsed.data;
    if (!context.patientId && !context.leadId) {
      return { content: 'Bu rezervasyonu adınıza doğrulayamadım.' };
    }

    const items = await this.support.loadOwnedTransferBookings(context);
    const owned = items.find((b) => b.reference === reference);
    if (!owned) {
      return {
        content:
          'Bu rezervasyonu adınıza doğrulayamadım; yalnızca size ait rezervasyonu iptal edebilirim.',
      };
    }

    const cancelDto: CancelTransferBookingDto = {
      reference,
      language: 'en',
    } as CancelTransferBookingDto;
    const cancellation = await this.commandBus.execute(
      new CancelTransferBookingCommand(cancelDto, ctx)
    );

    // İade dahili rezervasyon id'si (owned.id) ile BookingPayment'a bağlanır.
    const refunded = await this.support.refundForCancelledBooking({
      bookingId: owned.id,
      retained: cancellation.retained,
    });

    return {
      content: JSON.stringify({
        success: true,
        message: refunded
          ? 'Transfer rezervasyonunuz iptal edildi ve ödemeniz iade ediliyor.'
          : 'Transfer rezervasyonunuz iptal edildi. Ödeme iadeniz için ekibimiz sizinle iletişime geçecek.',
      }),
    };
  }
}
