import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { IPaymentCommandRepository } from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

@Injectable()
export class PaymentCommandRepository
  extends BaseCommandRepository<Payment>
  implements IPaymentCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<Payment | null> {
    const raw = await this.db.payment.findUnique({
      where: { id },
      include: { installments: { orderBy: { installmentNo: 'asc' } } },
    });
    return raw ? new Payment(raw) : null;
  }

  /**
   * Taksitin ödemesini kilitleyerek yükler: önce taksitten `paymentId` çözülür,
   * ödeme satırı `FOR UPDATE` ile kilitlenir, sonra taze hâli okunur. Sıra önemli —
   * kilitten önce okunan veri bayat olabilir.
   */
  async findByInstallmentIdForUpdate(
    installmentId: string
  ): Promise<Payment | null> {
    const installment = await this.db.paymentInstallment.findUnique({
      where: { id: installmentId },
      select: { paymentId: true },
    });
    if (!installment) return null;

    await this.lockRowForUpdate('payments', installment.paymentId);

    const raw = await this.db.payment.findUnique({
      where: { id: installment.paymentId },
      include: { installments: { orderBy: { installmentNo: 'asc' } } },
    });
    return raw ? new Payment(raw) : null;
  }

  async create(entity: Payment): Promise<Payment> {
    const data = entity.toPersistence();

    const paymentOp = this.db.payment.create({ data });
    const installmentOps = entity.installments.map((inst) =>
      this.db.paymentInstallment.create({
        data: {
          id: inst.id,
          paymentId: inst.paymentId,
          installmentNo: inst.installmentNo,
          amount: inst.amount,
          currency: inst.currency,
          method: inst.method,
          status: inst.status,
          dueDate: inst.dueDate,
          paidAt: inst.paidAt,
          note: inst.note,
        },
      })
    );

    if (txStorage.getStore()?.tx) {
      await Promise.all([paymentOp, ...installmentOps]);
    } else {
      await this.prisma.$transaction([paymentOp, ...installmentOps]);
    }

    entity.flushEvents();
    return entity;
  }

  async update(entity: Payment): Promise<Payment> {
    const persistenceData = entity.toPersistence();

    const { id, ...data } = persistenceData;

    const paymentOp = this.db.payment.update({
      where: { id },
      data,
    });
    // Taksitler ödeme ile birlikte create()'te açılır → save yalnız durum günceller.
    const installmentOps = entity.installments.map((inst) =>
      this.db.paymentInstallment.update({
        where: { id: inst.id },
        data: { status: inst.status, paidAt: inst.paidAt },
      })
    );

    if (txStorage.getStore()?.tx) {
      await Promise.all([paymentOp, ...installmentOps]);
    } else {
      await this.prisma.$transaction([paymentOp, ...installmentOps]);
    }

    entity.flushEvents();
    return entity;
  }
}
