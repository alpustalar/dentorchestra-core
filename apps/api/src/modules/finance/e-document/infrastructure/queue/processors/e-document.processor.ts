import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { E_DOCUMENT_JOBS, QUEUES } from '@common/constants';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { PartyRoleSchema } from '@shared';
import {
  E_INVOICE_PORT,
  EInvoicePort,
} from '@modules/finance/e-document/domain/ports/e-invoice.port';
import { resolveDocumentType } from '@modules/finance/e-document/domain/services/document-type-resolver';

import { GetInvoiceByIdQuery } from '@modules/finance/invoice/application/queries/get-invoice-by-id/get-invoice-by-id.query';
import { MarkInvoiceEDocumentResultCommand } from '@modules/finance/invoice/application/commands/mark-invoice-edocument-result/mark-invoice-edocument-result.command';
import { GetClinicGovernmentSpecsQuery } from '@modules/organization/clinic-governance/application/queries/get-clinic-government-specs/get-clinic-government-specs.query';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import {
  EDocumentRequest,
  EDocumentResult,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { ClaimInvoiceEDocumentDispatchCommand } from '@modules/finance/invoice/application/commands/claim-invoice-edocument-dispatch/claim-invoice-edocument-dispatch.command';
import { MarkInvoiceEDocumentFailedCommand } from '@modules/finance/invoice/application/commands/mark-invoice-edocument-failed/mark-invoice-edocument-failed.command';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import { GetClinicEDocumentProfileQuery } from '@modules/organization/clinic/application/queries/get-clinic-edocument-profile/get-clinic-edocument-profile.query';

interface SendJobData {
  invoiceId: string;
}

interface CancelJobData {
  invoiceId: string;
  documentType: EDocumentType;
  uuid: string;
  reason: string;
  clinicId: string;
}

type EDocumentJobData = SendJobData | CancelJobData;

/**
 * e-Belge gönderim işleyicisi (doc 07 §5). Faturayı, satıcı (klinik) ve alıcı (hasta
 * carisi) kimliklerini toplar, belge türünü çözer, portu çağırır ve sonucu faturaya
 * işler. Entegratör kapalıyken NoopEInvoiceAdapter devrede → belge INTERNAL kalır,
 * akış hata fırlatmadan tamamlanır.
 */
@Processor(QUEUES.E_DOCUMENT)
export class EDocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(EDocumentProcessor.name);
  private readonly internalCtx = ExecutionContextFactory.createInternal();

  constructor(
    @Inject(E_INVOICE_PORT) private readonly eInvoicePort: EInvoicePort,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {
    super();
  }

  async process(job: Job<EDocumentJobData>): Promise<void> {
    switch (job.name) {
      case E_DOCUMENT_JOBS.SEND:
        await this.handleSend(job.data.invoiceId);
        break;
      case E_DOCUMENT_JOBS.CANCEL:
        await this.handleCancel(job.data as CancelJobData);
        break;
      default:
        this.logger.warn(`Bilinmeyen e-belge job'u: ${job.name}`);
    }
  }

  /**
   * Entegratörde iptal bildirimi. Fatura **yerelde zaten iptal edilmiştir**
   * (storno atıldı, belge CANCELLED damgalandı); bu adım yalnız vergi
   * idaresindeki belgeyi hükümsüz kılar — doc 07 §5 uyarınca outbound ve
   * muhasebeden bağımsızdır.
   *
   * Hata YUTULMAZ: yükselir, BullMQ yeniden dener (5 deneme) ve tükenirse job
   * dead-letter'da kalır + CRITICAL alarm düşer. Yutulsaydı "yerelde iptal, vergi
   * idaresinde geçerli" belge kalıcı ve görünmez olurdu (CLAUDE.md finans
   * kuralı 4).
   */
  private async handleCancel(data: CancelJobData): Promise<void> {
    try {
      await this.eInvoicePort.cancel({
        clinicId: data.clinicId,
        documentType: data.documentType,
        uuid: data.uuid,
        reason: data.reason,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.criticalFailure.publish({
        operation: 'finance.e-document.cancel',
        severity: 'CRITICAL',
        summary:
          'Fatura yerelde iptal edildi ama entegratörde iptal bildirimi yapılamadı.',
        errorMessage,
        context: {
          invoiceId: data.invoiceId,
          einvoiceUuid: data.uuid,
          clinicId: data.clinicId,
        },
        clinicId: data.clinicId,
        dedupeKey: `edocument-cancel-failed:${data.invoiceId}`,
      });

      throw error;
    }

    this.logger.log(
      `e-Belge entegratörde iptal edildi: invoiceId=${data.invoiceId}, uuid=${data.uuid}`
    );
  }

  private async handleSend(invoiceId: string): Promise<void> {
    const { data: invoice } = await this.queryBus.execute(
      new GetInvoiceByIdQuery(invoiceId, this.internalCtx)
    );
    if (!invoice) {
      this.logger.warn(`Fatura bulunamadı, e-belge atlanıyor: ${invoiceId}`);
      return;
    }

    // Satıcı: kliniğin devlet/regülasyon kimliği (VKN + yasal tip).
    const { data: specs } = await this.queryBus.execute(
      new GetClinicGovernmentSpecsQuery(invoice.clinicId, this.internalCtx)
    );
    const legalType = specs?.legalType ?? 'KURUM';
    const { data: clinic } = await this.queryBus.execute(
      new GetClinicEDocumentProfileQuery(invoice.clinicId, this.internalCtx)
    );

    // Alıcı: hastanın finans carisi (idempotent garanti → party detayı).
    const { partyId } = await this.commandBus.execute(
      new EnsurePartyForPatientCommand(
        invoice.patientId,
        invoice.clinicId,
        PartyRoleSchema.enum.CUSTOMER,
        this.internalCtx
      )
    );
    const { data: buyer } = await this.queryBus.execute(
      new GetPartyByIdQuery(partyId, this.internalCtx)
    );

    const documentType = resolveDocumentType({
      legalType,
      buyerIsEInvoiceUser: buyer?.isEInvoiceUser ?? false,
    });

    // GÖNDERİM HAKKI: entegratöre belge göndermek geri alınamaz. Koşullu tek
    // UPDATE ile hak sahiplenilir; kazanamayan çalıştırma (job retry, elle
    // yeniden tetikleme) gönderimi ATLAR. Aksi halde port çağrısı başarılı olup
    // sonucu yazma adımı patladığında retry ikinci bir yasal belge üretirdi.
    const claimed = await this.commandBus.execute(
      new ClaimInvoiceEDocumentDispatchCommand(invoice.id)
    );
    if (!claimed) {
      this.logger.warn(
        `e-Belge gönderimi atlandı — hak başka bir çalıştırmada: invoiceId=${invoice.id}`
      );
      return;
    }

    const request: EDocumentRequest = {
      clinicId: invoice.clinicId,
      type: documentType,
      invoiceId: invoice.id,
      // Gerçek entegratör adapter'ları bu anahtarı sağlayıcı tarafında da
      // tekilleştirme için kullanır (çekirdek tarafındaki kapı claim'dir).
      idempotencyKey: invoice.id,
      // Belge tarihi = faturanın kendi `issuedAt` damgası = defterdeki ekonomik
      // olayın tarihi (hepsi fatura kesilirken tek anda yazılır). `now`'a düşmek
      // yalnız bu damganın eklenmesinden ÖNCE kesilmiş kayıtlar için geçerli bir
      // yoldur; yoksa kuyrukta bekleyen bir gönderim, belgeyi gönderim gününe
      // tarihleyip defterden koparırdı.
      issueDate: invoice.issuedAt ?? DateTimeManager.create(),
      seller: {
        taxId: specs?.companyTaxNumber ?? null,
        name: clinic?.name ?? '',
        address: clinic?.address ?? null,
        district: clinic?.district ?? null,
        city: clinic?.city ?? null,
        phone: clinic?.phone ?? null,
        email: clinic?.email ?? null,
      },
      buyer: {
        taxId: buyer?.taxNumber ?? buyer?.nationalId ?? null,
        name: buyer?.name ?? '',
        taxOffice: buyer?.taxOffice ?? null,
        address: buyer?.address ?? null,
        phone: buyer?.phone ?? null,
        email: buyer?.email ?? null,
        isEInvoiceUser: buyer?.isEInvoiceUser ?? false,
        alias: buyer?.eInvoiceMailbox ?? null,
      },
      lines: [
        {
          name: 'Hizmet bedeli',
          quantity: 1,
          unitPrice: invoice.netTotal,
          vatRate: Number(invoice.vatRate),
          vatAmount: invoice.vatTotal,
        },
      ],
      totals: {
        net: invoice.netTotal,
        vat: invoice.vatTotal,
        payable: invoice.grandTotal,
      },
      currency: invoice.currency,
    };

    let result: EDocumentResult;
    try {
      result = await this.eInvoicePort.issue(request);
    } catch (error) {
      // Belge entegratörde oluştu mu bilinmiyor (timeout/5xx ayrımı yapılamaz).
      // Bu yüzden FAILED işaretlenir ve gönderim hakkı bir daha otomatik
      // sahiplenilemez: mükerrer yasal belge riski, elde kalan belgeden ağırdır.
      await this.markFailed(invoice.id, invoice.clinicId, error);
      throw error;
    }

    await this.commandBus.execute(
      new MarkInvoiceEDocumentResultCommand(
        {
          invoiceId: invoice.id,
          documentType: result.documentType,
          uuid: result.uuid,
          status: result.status,
          invoiceNumber: result.invoiceNumber,
          rawResponse: result.rawResponse,
        },
        this.internalCtx
      )
    );

    this.logger.log(
      `e-Belge işlendi: invoiceId=${invoice.id}, tür=${result.documentType}, durum=${result.status}`
    );
  }

  /**
   * Gönderim hatasını faturaya ve alarma yazar. Hata yutulmaz (çağıran yeniden
   * fırlatır) — amaç, elde kalmış belgeyi görünür kılmak: FAILED durumundan
   * çıkış otomatik değil, bilinçli bir insan kararıdır.
   */
  private async markFailed(
    invoiceId: string,
    clinicId: string,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      await this.commandBus.execute(
        new MarkInvoiceEDocumentFailedCommand({
          invoiceId,
          reason: errorMessage,
          ctx: this.internalCtx,
        })
      );
    } catch (markError) {
      this.logger.error(
        `e-Belge hatası faturaya işlenemedi: invoiceId=${invoiceId}`,
        markError
      );
    }

    this.criticalFailure.publish({
      operation: 'finance.e-document.send',
      severity: 'CRITICAL',
      summary:
        'e-Belge entegratöre gönderilemedi; belgenin oluşup oluşmadığı bilinmiyor.',
      errorMessage,
      // Uyarı kiracısıyla gidiyor: elde kalmış yasal belgeyi hangi şubenin
      // takip edeceği, alarmın tek pratik sorusudur (fatura iki satır yukarıda
      // elimizde olduğu hâlde `null` geçiliyordu).
      context: { invoiceId, clinicId },
      clinicId,
      dedupeKey: `edocument-send-failed:${invoiceId}`,
    });
  }
}
