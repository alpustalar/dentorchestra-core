import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import {
  IPurchaseInvoiceCommandRepository,
  PURCHASE_INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { PurchaseInvoiceNotFoundException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ReverseJournalEntryByEventCommand } from '@modules/finance/accounting/posting/application/commands/reverse-journal-entry-by-event/reverse-journal-entry-by-event.command';
import { RevertInvoiceFromPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/revert-invoice-from-purchase-order/revert-invoice-from-purchase-order.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { PURCHASE_INVOICE_EVENTS } from '@src/domain/constants/events/purchase-invoice.constant';
import { CancelPurchaseInvoiceCommand } from './cancel-purchase-invoice.command';

/**
 * Alış faturasını iptal eder: belge damgası + defter stornosu + sipariş sayacı
 * **tek transaction**.
 *
 * Neden tek transaction: üç yazma birbirinin tamamlayıcısıdır. Storno atılıp
 * sayaç düşmezse sipariş kalıcı olarak "fazla faturalanmış" kalır ve kalan
 * bakiyesine fatura kesilemez; sayaç düşüp storno atılmazsa 320 borcu defterde
 * iptal edilmiş bir belgeyle ayakta kalır. Hata YUTULMAZ — her şey geri sarılır
 * ve komut güvenle yeniden denenir (fatura `cancel()` guard'ı mükerrer iptali
 * kapatır).
 *
 * Fatura **kilitli** okunur: iptal hem defteri hem siparişin kümülatif sayacını
 * değiştiriyor; kilitsiz okumada iki eşzamanlı istek de faturayı etkin görüp iki
 * storno + iki sayaç düşümü üretebilirdi.
 */
@CommandHandler(CancelPurchaseInvoiceCommand)
export class CancelPurchaseInvoiceHandler implements ICommandHandler<
  CancelPurchaseInvoiceCommand,
  void
> {
  constructor(
    @Inject(PURCHASE_INVOICE_COMMAND_REPOSITORY)
    private readonly purchaseInvoiceCommandRepo: IPurchaseInvoiceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus
  ) {}

  async execute(command: CancelPurchaseInvoiceCommand): Promise<void> {
    const { invoiceId, data, ctx } = command.payload;

    await this.txManager.outboxRun(async () => {
      const invoice =
        await this.purchaseInvoiceCommandRepo.findByIdForUpdate(invoiceId);
      if (!invoice) throw new PurchaseInvoiceNotFoundException(invoiceId);

      // Kapsam faturanın kendi kliniğinden; ölçüt "erişim" değil **yönetim**:
      // bir borcu hükümsüz kılmak, onu kaydetmekten daha yüksek etkilidir.
      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanManageTargetClinic(invoice.clinicId.value)
        )
        .orThrow(PURCHASE_INVOICE_EVENTS.CANCELLED);

      // Sipariş bağı iz olarak korunur; sayaç aşağıda düşülür. Bu yüzden
      // `unmatchFromOrder` iptal edilmiş faturada artık reddediliyor (çift düşüm).
      const purchaseOrderId = invoice.purchaseOrderId;
      const grandTotal = invoice.grandTotal.value.toFixed(2);

      invoice.cancel({
        reason: data.reason,
        cancelledById: ctx.actor.userId,
        source: ctx.actor.source,
      });

      await this.purchaseInvoiceCommandRepo.update(invoice);

      await this.commandBus.execute(
        new ReverseJournalEntryByEventCommand({
          dedupeKey: FinancialEventDedupeKeys.purchase_invoice(
            invoice.id.value
          ),
          reason: `Alış faturası iptali: ${data.reason}`,
          ctx,
        })
      );

      if (purchaseOrderId) {
        await this.commandBus.execute(
          new RevertInvoiceFromPurchaseOrderCommand({
            orderId: purchaseOrderId,
            invoiceId: invoice.id.value,
            grandTotal,
            ctx,
          })
        );
      }
    });
  }
}
