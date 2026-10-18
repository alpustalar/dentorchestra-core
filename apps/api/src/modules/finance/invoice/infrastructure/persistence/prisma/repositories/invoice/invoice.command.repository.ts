import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { CreateInvoiceProps } from '@modules/finance/invoice/domain/contracts/invoice';
import { Invoice } from '@modules/finance/invoice/domain/entities/invoice.entity';
import { IInvoiceCommandRepository } from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';
import { InvoiceDuplicateException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { ACTIVE_INVOICE_STATUSES } from '@modules/finance/invoice/domain/constants/invoice-status.constant';

@Injectable()
export class InvoiceCommandRepository
  extends BaseRepository
  implements IInvoiceCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<Invoice | null> {
    const raw = await this.db.invoice.findUnique({
      where: { id, isDeleted: false },
    });
    return raw ? new Invoice(raw) : null;
  }

  async findByIdForUpdate(id: string): Promise<Invoice | null> {
    await this.lockRowForUpdate('invoices', id);
    return this.findById(id);
  }

  /**
   * **Etkin** fatura aranır (`ACTIVE_INVOICE_STATUSES`): iptal edilmiş fatura
   * yerinde kalır ama ticari olarak hükümsüzdür, dolayısıyla "bu randevunun
   * faturası var" cevabını vermemelidir — yoksa hatalı kesilip iptal edilmiş bir
   * belge, doğrusunun kesilmesini sonsuza kadar engellerdi. Kabul kümesi DB'deki
   * kısmî unique index ile aynı sabitten gelir (CLAUDE.md finans kuralı 12).
   */
  async findByAppointmentId(appointmentId: string): Promise<Invoice | null> {
    const raw = await this.db.invoice.findFirst({
      where: {
        appointmentId,
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
    return raw ? new Invoice(raw) : null;
  }

  async findByPaymentId(paymentId: string): Promise<Invoice | null> {
    const raw = await this.db.invoice.findFirst({
      where: {
        paymentId,
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
    return raw ? new Invoice(raw) : null;
  }

  /**
   * Mükerrer faturayı nihai olarak DB kısıtı engeller (`appointment_id` /
   * `payment_id` unique): "önce sorgula, yoksa oluştur" kontrolü ile yazma
   * arasındaki pencerede ikinci istek gelirse burada P2002 alınır. Yarışı
   * kaybeden taraf bunu tipli bir domain hatasına çevirip yukarıda kazananın
   * faturasını okur.
   */
  async create(props: CreateInvoiceProps): Promise<Invoice> {
    try {
      return await this.insert(props);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new InvoiceDuplicateException();
      }
      throw error;
    }
  }

  private async insert(props: CreateInvoiceProps): Promise<Invoice> {
    const raw = await this.db.invoice.create({
      data: {
        id: props.id,
        organizationId: props.organizationId,
        clinicId: props.clinicId,
        patientId: props.patientId,
        appointmentId: props.appointmentId,
        paymentId: props.paymentId,
        amount: props.amount,
        currency: props.currency,
        vatRate: props.vatRate,
        netTotal: props.netTotal,
        vatTotal: props.vatTotal,
        status: props.status,
        invoiceNumber: props.invoiceNumber,
        issuedAt: props.issuedAt,
        providerRef: props.providerRef,
        rawResponse: props.rawResponse ?? undefined,
      },
    });
    return new Invoice(raw);
  }

  /**
   * Gönderim hakkı yalnız **etkin** faturada sahiplenilebilir: iptal edilmiş bir
   * fatura için entegratöre yasal belge göndermek geri alınamaz bir hatadır.
   * Koşul buraya konur, processor'a değil — hakkı veren tek UPDATE'in kendisi
   * varlığa içkin koşulu zorlamak zorundadır (CLAUDE.md finans kuralı 10):
   * iptal ile kuyruktaki gönderim yarışırsa kaybeden taraf hiç göndermemeli.
   */
  async claimForEDocumentDispatch(invoiceId: string): Promise<boolean> {
    const { count } = await this.db.invoice.updateMany({
      where: {
        id: invoiceId,
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
        einvoiceStatus: EDocumentStatusSchema.enum.DRAFT,
      },
      data: { einvoiceStatus: EDocumentStatusSchema.enum.QUEUED },
    });

    return count === 1;
  }

  async update(entity: Invoice): Promise<Invoice> {
    const data = entity.toPersistence();
    const raw = await this.db.invoice.update({
      where: { id: data.id },
      data: {
        status: data.status,
        invoiceNumber: data.invoiceNumber,
        issuedAt: data.issuedAt,
        providerRef: data.providerRef,
        documentType: data.documentType,
        einvoiceUuid: data.einvoiceUuid,
        einvoiceStatus: data.einvoiceStatus,
        // İptal damgası: `status` alanı tek başına kimin/ne zaman iptal ettiğini
        // taşımaz. Mapping'de alan düşmesi sessiz veri kaybıdır (kural 9) —
        // şemaya eklenen her para/damga kolonu bu listeye de eklenir.
        cancelledAt: data.cancelledAt,
        cancelledById: data.cancelledById,
        cancelReason: data.cancelReason,
        rawResponse: data.rawResponse ?? undefined,
        updatedAt: data.updatedAt,
      },
    });
    entity.flushEvents();
    return new Invoice(raw);
  }
}
