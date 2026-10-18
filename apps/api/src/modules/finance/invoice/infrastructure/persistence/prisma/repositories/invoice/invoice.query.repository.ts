import { Injectable } from '@nestjs/common';
import { Invoice as IInvoice, Pagination } from '@shared';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { paginate } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { FindInvoicesFilter } from '@modules/finance/invoice/domain/contracts/invoice';
import { IInvoiceQueryRepository } from '@modules/finance/invoice/domain/repositories/invoice/invoice.query.repository';
import { ACTIVE_INVOICE_STATUSES } from '@modules/finance/invoice/domain/constants/invoice-status.constant';

/**
 * Okuma tarafı: entity hidrate edilmez. Mükerrer fatura kontrolü ve e-Belge sonucu
 * işleme gibi yazma kararını besleyen okumalar Command Repo'dadır.
 */
@Injectable()
export class InvoiceQueryRepository
  extends BaseRepository
  implements IInvoiceQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string): Promise<IInvoice | null> {
    return this.db.invoice.findUnique({ where: { id, isDeleted: false } });
  }

  /**
   * Tekil arama **etkin** faturayı döndürür (`ACTIVE_INVOICE_STATUSES`): bir
   * tahsilat/randevu için iptal edilmiş eski belgeler yerinde kalabilir, ekranda
   * geçerli olan gösterilmelidir. Kabul kümesi tek sabitten (kural 12).
   */
  findByPaymentId(paymentId: string): Promise<IInvoice | null> {
    return this.db.invoice.findFirst({
      where: {
        paymentId,
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
  }

  findByAppointmentId(appointmentId: string): Promise<IInvoice | null> {
    return this.db.invoice.findFirst({
      where: {
        appointmentId,
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
  }

  /**
   * Faturası olan ödemeler. İptal edilmiş fatura **saymaz**: o tahsilat yeniden
   * "faturası eksik" adayıdır, aksi halde telafi komutu (backfill) onu sonsuza
   * kadar atlardı.
   */
  async findExistingPaymentIds(paymentIds: string[]): Promise<string[]> {
    if (paymentIds.length === 0) return [];

    const rows = await this.db.invoice.findMany({
      where: {
        paymentId: { in: paymentIds },
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
      select: { paymentId: true },
    });

    return rows
      .map((row) => row.paymentId)
      .filter((id): id is string => id !== null);
  }

  findMany(
    filter: FindInvoicesFilter,
    pagination: Pagination
  ): Promise<{ items: IInvoice[]; total: number }> {
    return paginate({
      delegate: this.db.invoice,
      pagination,
      where: {
        organizationId: filter.organizationId,
        isDeleted: false,
        ...(filter.clinicId ? { clinicId: filter.clinicId } : {}),
      },
    });
  }
}
