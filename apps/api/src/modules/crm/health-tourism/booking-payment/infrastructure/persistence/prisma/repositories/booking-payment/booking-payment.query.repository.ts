import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BookingPayment } from '@shared';
import { IBookingPaymentQueryRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.query.repository';
import {
  BridgeableBookingLedgerRow,
  FindBridgeableBookingPaymentsFilter,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

@Injectable()
export class BookingPaymentQueryRepository
  extends BaseRepository
  implements IBookingPaymentQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<BookingPayment | null> {
    return this.db.bookingPayment.findUnique({ where: { id } });
  }

  findByStripeSessionId(sessionId: string): Promise<BookingPayment | null> {
    return this.db.bookingPayment.findUnique({
      where: { stripeSessionId: sessionId },
    });
  }

  findByIyzicoConversationId(
    conversationId: string
  ): Promise<BookingPayment | null> {
    return this.db.bookingPayment.findUnique({
      where: { iyzicoConversationId: conversationId },
    });
  }

  findBridgeable(
    filter: FindBridgeableBookingPaymentsFilter
  ): Promise<BridgeableBookingLedgerRow[]> {
    const window = { gte: filter.from, lte: filter.to };

    return this.db.bookingPayment
      .findMany({
        where: {
          // Rezervasyon fiilen açıldı → tahsilat fişi borçlu. `markBooked`
          // çalışmadıysa (PAID → FAILED → REFUNDED) hiçbir fiş borçlu değildir.
          bookingReference: { not: null },
          ...(filter.clinicId ? { clinicId: filter.clinicId } : {}),
          // İki yön iki ayrı tarihte yaşar: tahsilat `paidAt`, iade `refundedAt`.
          // Tek tarihe bakmak, geçen dönem tahsil edilip bu dönem iade edilen bir
          // rezervasyonun eksik fişini görünmez yapardı.
          OR: [{ paidAt: window }, { refundedAt: window }],
        },
        select: {
          id: true,
          clinicId: true,
          bookingType: true,
          status: true,
          paidProvider: true,
          paidAt: true,
          refundedAt: true,
        },
        orderBy: { paidAt: 'asc' },
      })
      .then((rows) =>
        rows.map((row) => ({
          bookingPaymentId: row.id,
          clinicId: row.clinicId,
          bookingType: row.bookingType,
          status: row.status,
          paidProvider: row.paidProvider,
          paidAt: row.paidAt,
          refundedAt: row.refundedAt,
        }))
      );
  }
}
