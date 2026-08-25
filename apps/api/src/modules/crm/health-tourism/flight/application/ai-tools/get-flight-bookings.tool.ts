import { Injectable } from '@nestjs/common';
import {
  AI_TOOL_NAMES,
  AiTool,
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
  IAiSubToolHandler,
} from '@common/ai-tools';
import { AiToolSupport } from '@modules/platform/ai-tools/application/ai-tool.support';

/** Yazışmaya bağlı kişinin KENDİ uçuş rezervasyonlarını listeler (sahiplik doğrulamalı). */
@AiTool()
@Injectable()
export class GetFlightBookingsTool implements IAiSubToolHandler {
  constructor(private readonly support: AiToolSupport) {}

  get name(): string {
    return AI_TOOL_NAMES.GET_FLIGHT_BOOKINGS;
  }

  get definition(): AiToolDefinition {
    return {
      name: AI_TOOL_NAMES.GET_FLIGHT_BOOKINGS,
      description:
        "Yazışmadaki hastanın/lead'in KENDİ uçuş rezervasyonlarını listeler (PNR, durum, güzergâh). Başkasının rezervasyonu görüntülenemez. cancel_flight_booking için gereken bookingId buradan alınır.",
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };
  }

  async execute(
    _input: Record<string, unknown>,
    context: AiToolContext
  ): Promise<AiToolResult> {
    if (!context.patientId && !context.leadId) {
      return {
        content:
          'Bu yazışma bir kayda bağlı olmadığından uçuş rezervasyonu listelenemedi.',
      };
    }

    const items = await this.support.loadOwnedFlightBookings(context);
    const bookings = items
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => ({
        bookingId: b.id,
        pnr: b.bookingReference,
        status: b.status,
        amount: b.totalAmount.toString(),
        currency: b.currency,
      }));

    if (bookings.length === 0) {
      return { content: 'Aktif uçuş rezervasyonunuz bulunmuyor.' };
    }
    return { content: JSON.stringify({ bookings }) };
  }
}
