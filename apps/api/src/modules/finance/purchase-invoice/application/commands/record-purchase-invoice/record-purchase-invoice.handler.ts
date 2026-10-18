import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { IGetContext } from '@common/decorators';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import {
  IPurchaseInvoiceCommandRepository,
  PURCHASE_INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { PurchaseInvoice } from '@modules/finance/purchase-invoice/domain/entities/purchase-invoice.entity';
import {
  FinancialEventTypeSchema,
  PartyOriginTypeSchema,
  PartyRoleSchema,
  PartyTypeSchema,
} from '@shared';
import { RecordPurchaseInvoiceCommand } from './record-purchase-invoice.command';
import { ApplyInvoiceToPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/apply-invoice-to-purchase-order/apply-invoice-to-purchase-order.command';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { PriceBreakdown } from '@modules/finance/shared/domain/value-objects/price-breakdown.vo';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';

@CommandHandler(RecordPurchaseInvoiceCommand)
export class RecordPurchaseInvoiceHandler implements ICommandHandler<
  RecordPurchaseInvoiceCommand,
  string
> {
  constructor(
    @Inject(PURCHASE_INVOICE_COMMAND_REPOSITORY)
    private readonly purchaseInvoiceCommandRepo: IPurchaseInvoiceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus
  ) {}

  async execute(command: RecordPurchaseInvoiceCommand): Promise<string> {
    const { data, ctx } = command;

    // Kiracı kimliği istekten alınmaz, klinikten türetilir — DTO'da böyle bir
    // alan yok (bkz. RecordPurchaseInvoiceSchema).
    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(data.clinicId, organizationId)
      )
      .orThrow();

    // §13 P1-4'ün kalan yarısı: belge tarihinin üst sınırı (gelecek) kapandı ama
    // kapanmış döneme tarihli fatura hâlâ kabul ediliyordu — olay yazılıyor, fişi
    // hiç üretilemiyor ve append-only gövde düzeltilemiyordu. §15'te "ikinci bir
    // tüketici çıkarsa servis birlikte tasarlanır" diye ertelenmişti; satıcı
    // ödemesi ve bordro da aynı kapıyı istediği için servis artık var.
    await this.periodGate.assertPeriodNotSealedAt({
      clinicId: data.clinicId,
      date: data.invoiceDate,
    });

    const generatedPurchaseInvoiceId = UUID.generate();

    const priceBreakdown = PriceBreakdown.create({
      currency: data.currency,
      netAmount: data.netTotal,
      vatAmount: data.vatTotal,
    }).orThrow();

    const invoice = PurchaseInvoice.create({
      id: generatedPurchaseInvoiceId.value,
      clinicId: data.clinicId,
      organizationId,
      supplierId: data.supplierId,
      invoiceNumber: data.invoiceNumber ?? null,
      invoiceDate: data.invoiceDate,
      purchaseOrderId: data.purchaseOrderId ?? null,
      lineAccountCode: data.lineAccountCode,
      vatRate: data.vatRate,
      netTotal: priceBreakdown.netAmount.value,
      vatTotal: priceBreakdown.vatAmount.value,
      grandTotal: priceBreakdown.grandTotal.value,
      currency: priceBreakdown.grandTotal.currency,
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
    });

    // Belge kaydı + sipariş eşleştirmesi + muhasebe köprüsü aynı outboxRun içinde ve
    // köprü hatası YUTULMAZ: hata yükselir, her şey rollback olur. Yutulduğunda alış
    // faturası kaydedilip 320 Satıcılar borcu hiç yazılmıyordu ve bunu gösteren bir
    // mutabakat da yoktu (olay hiç yazılmadığı için `sweep-unposted-financial-events`
    // göremez). Komut doğal anahtar + dedupeKey sayesinde idempotenttir; çağıran
    // güvenle yeniden dener. Kardeş modül (satış faturası) de aynı politikayı izler.
    await this.txManager.outboxRun(async () => {
      await this.purchaseInvoiceCommandRepo.create(invoice);

      // Sipariş eşleştirmesi köprüden ÖNCE ve aynı transaction'da: tutar/tedarikçi
      // uyuşmazlığı faturayı hiç yazmadan (rollback) reddedilmeli — muhasebeye
      // düşmüş bir faturayı geri almak çok daha pahalıdır.
      if (data.purchaseOrderId) {
        await this.commandBus.execute(
          new ApplyInvoiceToPurchaseOrderCommand({
            orderId: data.purchaseOrderId,
            invoiceId: generatedPurchaseInvoiceId.value,
            clinicId: data.clinicId,
            supplierId: data.supplierId,
            grandTotal: priceBreakdown.grandTotal.value.toFixed(2),
            currency: priceBreakdown.grandTotal.currency,
            ctx,
          })
        );
      }

      await this.recordPurchaseInvoiceReceived({
        purchaseInvoiceId: generatedPurchaseInvoiceId.value,
        clinicId: data.clinicId,
        organizationId,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        supplierTaxNumber: data.supplierTaxNumber,
        supplierTaxOffice: data.supplierTaxOffice,
        invoiceDate: data.invoiceDate,
        lineAccountCode: data.lineAccountCode,
        netTotal: priceBreakdown.netAmount.value,
        vatTotal: priceBreakdown.vatAmount.value,
        grandTotal: priceBreakdown.grandTotal.value,
        currency: priceBreakdown.grandTotal.currency,
        ctx,
      });
    });

    return generatedPurchaseInvoiceId.value;
  }

  /**
   * Alış faturasını muhasebe katmanına köprüler: tedarikçi carisini (320) garanti
   * eder ve PURCHASE_INVOICE_RECEIVED olayını yazar. Olay Outbox'a düşer; posting
   * listener'ı fişi (150/770 + 191 / 320) üretir. dedupeKey ile idempotenttir.
   *
   * Bilinçli olarak try-catch YOK (bkz. `execute` yorumu): köprü hatası faturanın
   * kaydını da geri sarmalıdır — yoksa defterde eksik borç sessizce kalır.
   * Çağrılar gerçek aktörün ctx'iyle yapılır: borcu kimin yazdığı olayda da
   * görünmeli (internalCtx aktörü siliyordu).
   */

  private async recordPurchaseInvoiceReceived(
    input: RecordPurchaseInvoiceReceivedInput
  ): Promise<void> {
    const partyId = await this.commandBus.execute(
      new EnsurePartyCommand(
        {
          clinicId: input.clinicId,
          organizationId: input.organizationId,
          originType: PartyOriginTypeSchema.enum.SUPPLIER,
          originId: input.supplierId,
          role: PartyRoleSchema.enum.SUPPLIER,
          type: PartyTypeSchema.enum.COMPANY,
          name: input.supplierName,
          taxNumber: input.supplierTaxNumber ?? null,
          taxOffice: input.supplierTaxOffice ?? null,
        },
        input.ctx
      )
    );

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: input.clinicId,
          type: FinancialEventTypeSchema.enum.PURCHASE_INVOICE_RECEIVED,
          occurredAt: input.invoiceDate,
          payload: {
            partyId,
            netTotal: input.netTotal.toFixed(2),
            vatTotal: input.vatTotal.toFixed(2),
            grandTotal: input.grandTotal.toFixed(2),
            lineAccountCode: input.lineAccountCode,
            // Para birimi olaya MUTLAKA geçer: posting verilmediğinde defterin
            // fonksiyonel parasını varsayar, yani 1.000 USD'lik ithal fatura
            // deftere 1.000 TRY borç olarak düşerdi (kur çevrimi hiç tetiklenmez).
            currency: input.currency,
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PURCHASE_INVOICE,
          sourceRefId: input.purchaseInvoiceId,
          dedupeKey: FinancialEventDedupeKeys.purchase_invoice(
            input.purchaseInvoiceId
          ),
        },
        input.ctx
      )
    );
  }
}

interface RecordPurchaseInvoiceReceivedInput {
  purchaseInvoiceId: string;
  clinicId: string;
  organizationId: string;
  supplierId: string;
  supplierName: string;
  supplierTaxNumber?: string;
  supplierTaxOffice?: string;
  invoiceDate: Date;
  lineAccountCode: string;
  netTotal: Decimal;
  vatTotal: Decimal;
  grandTotal: Decimal;
  currency: CurrencyType;
  ctx: IGetContext;
}
