import { Injectable } from '@nestjs/common';
import { Pagination, BookingPaymentRefund } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { Paginated } from '@common/interfaces/paginated.type';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { IBookingPaymentRefundQueryRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.query.repository';
import {
  FindBridgeableBookingPaymentRefundsFilter,
  FindUnresolvedBookingPaymentRefundsFilter,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';
import { BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES } from '@modules/crm/health-tourism/booking-payment/domain/constants/booking-payment-refund.constant';

@Injectable()
export class BookingPaymentRefundQueryRepository
  extends BaseRepository
  implements IBookingPaymentRefundQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findUnresolved(params: {
    filter: FindUnresolvedBookingPaymentRefundsFilter;
    pagination: Pagination;
  }): Promise<Paginated<BookingPaymentRefund>> {
    const { filter, pagination } = params;
    const staleCutoff = DateTimeManager.subtractMinutes(
      DateTimeManager.create(),
      BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES
    );

    // "Kapanmamış" = sonucu doğrulanmamış (UNCONFIRMED), reddedilmiş ama kapatılmamış
    // (FAILED) ya da takılmış PENDING. Taze PENDING listelenmez: çağrı hâlâ sürüyor olabilir.
    const open = [
      { status: 'UNCONFIRMED' as const },
      { status: 'FAILED' as const },
      { status: 'PENDING' as const, requestedAt: { lte: staleCutoff } },
    ];

    const where: Record<string, unknown> = {
      OR: filter.status
        ? open.filter((clause) => clause.status === filter.status)
        : open,
    };
    if (filter.clinicId) where.clinicId = filter.clinicId;

    const result = await paginate({
      delegate: this.db.bookingPaymentRefund,
      pagination,
      where,
    });

    return {
      items: result.items as unknown as BookingPaymentRefund[],
      total: result.total,
    };
  }

  findBridgeable(
    filter: FindBridgeableBookingPaymentRefundsFilter
  ): Promise<BookingPaymentRefund[]> {
    const window = { gte: filter.from, lte: filter.to };

    return this.db.bookingPaymentRefund.findMany({
      where: {
        ...(filter.clinicId ? { clinicId: filter.clinicId } : {}),
        OR: [
          // İade sağlayıcıda gerçekleşti (ya da operatör doğruladı): ters kayıt borçlu.
          { status: 'CONFIRMED', refundedAt: window },
          // Para platform hesabına girdi ve iade edilecek: 336 açılışı borçlu.
          {
            origin: 'LIVE',
            kind: { not: 'CANCELLATION' },
            requestedAt: window,
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
