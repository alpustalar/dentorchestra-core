import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { PaymentInstallment } from '@shared/generated-zod/modelSchema/PaymentInstallmentSchema';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { IPaymentCommandRepository } from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

/**
 * Taksidin **INSERT** mapping'i — tek yerde. `create()` ve `update()` (eklenen
 * taksit) aynı fonksiyonu kullanır; alanlar tek tek yazıldığı için şemaya eklenen
 * her yeni kolon buraya da eklenmek ZORUNDADIR (CLAUDE.md finans kuralı 9):
 * düşen alan hata vermez, log üretmez ve geri getirilemez. Bu mapping'i
 * `payment.command.repository.spec.ts` kilitler.
 */
export function toInstallmentCreateData(inst: PaymentInstallment) {
  return {
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
    recoversInstallmentId: inst.recoversInstallmentId,
    reversalRequestedAt: inst.reversalRequestedAt,
  };
}

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

  async findByIdForUpdate(paymentId: string): Promise<Payment | null> {
    // Satır yoksa kilitlenecek tuple da yoktur; ardından gelen okuma `null`
    // döner ve çağıran tipli NotFound fırlatır (bkz. `lockRowForUpdate`).
    await this.lockRowForUpdate('payments', paymentId);

    const raw = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { installments: { orderBy: { installmentNo: 'asc' } } },
    });
    return raw ? new Payment(raw) : null;
  }

  async setReversalRequestedAt(params: {
    installmentId: string;
    requestedAt: Date | null;
  }): Promise<void> {
    await this.db.paymentInstallment.update({
      where: { id: params.installmentId },
      data: { reversalRequestedAt: params.requestedAt },
    });
  }

  async create(entity: Payment): Promise<Payment> {
    const data = entity.toPersistence();

    const paymentOp = this.db.payment.create({ data });
    const installmentOps = entity.installments.map((inst) =>
      this.db.paymentInstallment.create({
        data: toInstallmentCreateData(inst),
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
    // Taksitler ödeme ile birlikte create()'te açılır → mevcut taksitler için
    // yalnız durum güncellenir. İSTİSNA: bu işlemde EKLENEN taksit (ters ibrazın
    // telafi taksidi) INSERT edilir — `UPDATE` olsaydı satır olmadığı için
    // sessizce hiçbir şey yazmazdı (ya da P2025 ile patlardı). Telafi taksidi
    // geri alınan taksidi FK ile gösterir; o satır zaten var olduğundan sıra güvenli.
    const newIds = entity.newInstallmentIds;
    const installmentOps = entity.installments.map((inst) =>
      newIds.has(inst.id)
        ? this.db.paymentInstallment.create({
            data: toInstallmentCreateData(inst),
          })
        : this.db.paymentInstallment.update({
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
