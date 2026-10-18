import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { IPurchaseInvoiceCommandRepository } from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { PurchaseInvoice } from '@modules/finance/purchase-invoice/domain/entities/purchase-invoice.entity';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PurchaseInvoiceDuplicateException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';

@Injectable()
export class PurchaseInvoiceCommandRepository
  extends BaseCommandRepository<PurchaseInvoice>
  implements IPurchaseInvoiceCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<PurchaseInvoice | null> {
    const raw = await this.db.purchaseInvoice.findUnique({ where: { id } });
    return raw ? new PurchaseInvoice(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<PurchaseInvoice | null> {
    await this.lockRowForUpdateOrFail('purchase_invoices', id);
    return this.findById(id);
  }

  async update(entity: PurchaseInvoice): Promise<PurchaseInvoice> {
    const persistenceData = entity.toPersistence();
    const { id, ...data } = persistenceData;

    const raw = await this.db.purchaseInvoice.update({
      where: { id },
      data,
    });
    entity.flushEvents();
    return new PurchaseInvoice(raw);
  }

  /**
   * Mükerrer alış faturasını nihai olarak DB kısıtı engeller
   * (`clinic_id + supplier_id + invoice_number` unique): "zaten var mı" kontrolü
   * ile yazma arasındaki pencerede ikinci istek gelirse burada P2002 alınır ve
   * tipli bir domain hatasına çevrilir.
   *
   * Kazananın kaydı okunup idempotent şekilde DÖNÜLMEZ (satış faturasının aksine):
   * alış belgesini kullanıcı girer, tutarı/tarihi farklı olabilir ve "sessizce
   * mevcut olanı kabul ettim" demek yanlış tutarı onaylamak olur. Çakışma
   * kullanıcıya görünür.
   */
  async create(entity: PurchaseInvoice): Promise<PurchaseInvoice> {
    const data = entity.toPersistence();

    try {
      const raw = await this.db.purchaseInvoice.create({ data });
      entity.flushEvents();
      return new PurchaseInvoice(raw);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new PurchaseInvoiceDuplicateException({
          clinicId: data.clinicId,
          supplierId: data.supplierId,
          invoiceNumber: data.invoiceNumber,
        });
      }
      throw error;
    }
  }
}
