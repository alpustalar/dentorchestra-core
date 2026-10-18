import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  INVOICE_COMMAND_REPOSITORY,
  IInvoiceCommandRepository,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';
import { InvoiceNotFoundException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { EDOCUMENT_CANCEL_REQUIRED_STATUSES } from '@modules/finance/invoice/domain/constants/invoice-status.constant';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ReverseJournalEntryByEventCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry-by-event/reverse-journal-entry-by-event.command';
import { QueueEDocumentCancelCommand } from '@modules/finance/e-document/application/commands/queue-e-document-cancel/queue-e-document-cancel.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { INVOICE_EVENTS } from '@src/domain/constants/events/invoice.constant';
import { CancelInvoiceCommand } from './cancel-invoice.command';

/**
 * Faturayı iptal eder ve defterdeki etkisini storno ile götürür.
 *
 * Sıra ve atomiklik:
 * 1. Fatura **kilitli** okunur (`findByIdForUpdate`) — iptal, hem belge durumunu
 *    hem defteri değiştiren kümülatif bir karardır; kilitsiz okumada iki
 *    eşzamanlı istek de faturayı "etkin" görüp İKİ storno üretebilirdi (`cancel()`
 *    guard'ı yalnız kendi kopyasını korur).
 * 2. Belge damgası + storno **aynı `outboxRun`** içinde: biri olup diğeri olmazsa
 *    ya iptal edilmiş bir faturanın hasılatı defterde kalır ya da defterden
 *    düşmüş bir belge "geçerli" görünür. İç içe çağrılan storno komutu aynı
 *    transaction'a katılır (`TransactionManager` iç içe çağrıyı mevcut tx'e
 *    bağlar), yani hata her şeyi geri sarar. Köprü hatası YUTULMAZ.
 * 3. Entegratör iptal bildirimi **commit sonrası** kuyruğa düşer (doc 07 §5):
 *    outbound bir adımdır, iptali bloklamaz. Enqueue hatası akışı geri almaz —
 *    yalnız loglanır; kuyruk hatası ise CRITICAL alarma düşer.
 */
@CommandHandler(CancelInvoiceCommand)
export class CancelInvoiceHandler implements ICommandHandler<
  CancelInvoiceCommand,
  void
> {
  private readonly logger = new Logger(CancelInvoiceHandler.name);

  constructor(
    @Inject(INVOICE_COMMAND_REPOSITORY)
    private readonly invoiceRepo: IInvoiceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus
  ) {}

  async execute(command: CancelInvoiceCommand): Promise<void> {
    const { invoiceId, data, ctx } = command.payload;

    const integratorCancel = await this.txManager.outboxRun(async () => {
      const invoice = await this.invoiceRepo.findByIdForUpdate(invoiceId);
      if (!invoice) throw new InvoiceNotFoundException(invoiceId);

      // Kapsam faturanın KENDİ kliniğinden doğrulanır (istekten gelen id'den
      // değil). İptal yıkıcı bir düzeltme olduğu için ölçüt "erişim" değil
      // **yönetim**: storno yetkisi olan personel başka bir şubenin belgesini
      // hükümsüz kılamaz.
      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanManageTargetClinic(invoice.clinicId.value)
        )
        .orThrow(INVOICE_EVENTS.CANCELLED);

      invoice.cancel({
        reason: data.reason,
        cancelledById: ctx.actor.userId,
        source: ctx.actor.source,
      });

      await this.invoiceRepo.update(invoice);

      // Muhasebe bacağı: belge → ekonomik olay → fiş zinciri üzerinden storno.
      // Olay henüz fişlenmediyse komut hata fırlatır ve iptal geri sarılır —
      // "iptal edildi ama hasılatı defterde kaldı" durumuna izin verilmez.
      await this.commandBus.execute(
        new ReverseJournalEntryByEventCommand({
          dedupeKey: FinancialEventDedupeKeys.sales_invoice(invoice.id.value),
          reason: `Fatura iptali: ${data.reason}`,
          ctx,
        })
      );

      const needsIntegratorCancel =
        invoice.einvoiceUuid !== null &&
        EDOCUMENT_CANCEL_REQUIRED_STATUSES.includes(invoice.einvoiceStatus);

      return needsIntegratorCancel
        ? {
            invoiceId: invoice.id.value,
            uuid: invoice.einvoiceUuid.value,
            clinicId: invoice.clinicId.value,
          }
        : null;
    });

    if (!integratorCancel) return;

    try {
      await this.commandBus.execute(
        new QueueEDocumentCancelCommand({
          invoiceId: integratorCancel.invoiceId,
          uuid: integratorCancel.uuid,
          reason: data.reason,
          clinicId: integratorCancel.clinicId,
        })
      );
    } catch (error) {
      // İptal ve storno zaten commit edildi; kuyruğa alamamak onları geri
      // almaz. Elde kalan iş "entegratörde hâlâ geçerli belge" — bunu kuyruk
      // yeniden denemesi ya da operatör kapatır.
      this.logger.error(
        `e-Belge iptal bildirimi kuyruğa alınamadı: invoiceId=${integratorCancel.invoiceId}`,
        error
      );
    }
  }
}
