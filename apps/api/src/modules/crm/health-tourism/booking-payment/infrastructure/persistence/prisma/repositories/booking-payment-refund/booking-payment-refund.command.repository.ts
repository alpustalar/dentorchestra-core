import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { IBookingPaymentRefundCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentProviderValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';

@Injectable()
export class BookingPaymentRefundCommandRepository
  extends BaseCommandRepository<BookingPaymentRefund>
  implements IBookingPaymentRefundCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * `(provider, charge_provider_ref)` unique'i sahiplenmenin kendisidir: ikinci INSERT
   * P2002 ile düşer ve çağıran "zaten talep edilmiş = tekrar teslim" diye ele alır. Olay
   * defterinin dedupe'u bu işi göremez (mevcut kimliği sessizce döner).
   */
  async create(entity: BookingPaymentRefund): Promise<BookingPaymentRefund> {
    const data = entity.toPersistence();
    try {
      const raw = await this.db.bookingPaymentRefund.create({ data });
      entity.flushEvents();
      return new BookingPaymentRefund(raw);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BookingPaymentRefundAlreadyClaimedException(
          data.provider,
          data.chargeProviderRef
        );
      }
      throw error;
    }
  }

  /**
   * Alanlar tek tek yazılıyor: şemaya eklenen her değişken kolon bu listeye de eklenmek
   * ZORUNDA (kural 9). Kimlik / kiracı / tutar / tahsilat referansı değişmez; yazılmaz.
   */
  async update(entity: BookingPaymentRefund): Promise<BookingPaymentRefund> {
    const data = entity.toPersistence();
    const raw = await this.db.bookingPaymentRefund.update({
      where: { id: data.id },
      data: {
        status: data.status,
        attemptCount: data.attemptCount,
        reason: data.reason,
        failureReason: data.failureReason,
        requestedAt: data.requestedAt,
        requestedById: data.requestedById,
        providerRefundRef: data.providerRefundRef,
        refundedAt: data.refundedAt,
        resolution: data.resolution,
        resolvedById: data.resolvedById,
        resolvedAt: data.resolvedAt,
        resolutionNote: data.resolutionNote,
        updatedAt: data.updatedAt,
      },
    });

    entity.flushEvents();
    return new BookingPaymentRefund(raw);
  }

  async findById(id: string): Promise<BookingPaymentRefund | null> {
    const raw = await this.db.bookingPaymentRefund.findUnique({
      where: { id },
    });
    return raw ? new BookingPaymentRefund(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<BookingPaymentRefund | null> {
    await this.lockRowForUpdate('booking_payment_refunds', id);
    return this.findById(id);
  }

  async findByCharge(params: {
    provider: BookingPaymentProviderValue;
    chargeProviderRef: string;
  }): Promise<BookingPaymentRefund | null> {
    const raw = await this.db.bookingPaymentRefund.findUnique({
      where: {
        provider_chargeProviderRef: {
          provider: params.provider,
          chargeProviderRef: params.chargeProviderRef,
        },
      },
    });
    return raw ? new BookingPaymentRefund(raw) : null;
  }
}
