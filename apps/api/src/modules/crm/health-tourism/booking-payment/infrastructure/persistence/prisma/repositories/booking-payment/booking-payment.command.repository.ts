import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { Prisma } from '@prisma/client';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';

@Injectable()
export class BookingPaymentCommandRepository
  extends BaseCommandRepository<BookingPayment>
  implements IBookingPaymentCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Alanlar tek tek yazılıyor (`...rest` değil) çünkü bu metod `create` alanlarına
   * (tutarlar, intent, kiracı) dokunmamalı. Bedeli: **şemaya eklenen her yeni
   * değişken kolon bu listeye de eklenmek ZORUNDA** — entity'nin hesapladığı ama
   * mapping'in yazmadığı alan hata vermez, log üretmez ve geri getirilemez
   * (CLAUDE.md finans kuralı 9). `supplier_amount` tam böyle düşmüştü: damga
   * entity'de hesaplanıyor, `toPersistence` taşıyor, burada kayboluyordu → defter
   * her rezervasyonda "fiilî maliyet bilinmiyor" alarmı verirdi.
   */
  async update(entity: BookingPayment): Promise<BookingPayment> {
    const data = entity.toPersistence();
    const raw = await this.db.bookingPayment.update({
      where: { id: data.id },
      data: {
        status: data.status,
        iyzicoConversationId: data.iyzicoConversationId,
        iyzicoToken: data.iyzicoToken,
        iyzicoUrl: data.iyzicoUrl,
        stripeSessionId: data.stripeSessionId,
        stripeUrl: data.stripeUrl,
        paidProvider: data.paidProvider,
        paidProviderRef: data.paidProviderRef,
        paidAt: data.paidAt,
        bookingReference: data.bookingReference,
        bookingId: data.bookingId,
        failureReason: data.failureReason,
        supplierAmount: data.supplierAmount,
        supplierCurrency: data.supplierCurrency,
        supplierRetainedAmount: data.supplierRetainedAmount,
        supplierRetainedCurrency: data.supplierRetainedCurrency,
        refundedAt: data.refundedAt,
        refundReason: data.refundReason,
        updatedAt: data.updatedAt,
      },
    });

    entity.flushEvents();
    return new BookingPayment(raw);
  }

  async create(entity: BookingPayment): Promise<BookingPayment> {
    const create = entity.toPersistence();
    const { intent, ...rest } = create;

    const data = {
      ...rest,
      intent: intent ?? Prisma.JsonNull,
    };

    const raw = await this.db.bookingPayment.create({ data });
    entity.flushEvents();
    return new BookingPayment(raw);
  }

  async findById(id: string): Promise<BookingPayment | null> {
    const raw = await this.db.bookingPayment.findUnique({ where: { id } });
    return raw ? new BookingPayment(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<BookingPayment | null> {
    await this.lockRowForUpdate('booking_payments', id);
    return this.findById(id);
  }

  async findByBookingId(bookingId: string): Promise<BookingPayment | null> {
    const raw = await this.db.bookingPayment.findFirst({
      where: { bookingId },
    });
    return raw ? new BookingPayment(raw) : null;
  }

  async findByBookingIdForUpdate(
    bookingId: string
  ): Promise<BookingPayment | null> {
    const existing = await this.db.bookingPayment.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    if (!existing) return null;

    return this.findByIdForUpdate(existing.id);
  }
}
