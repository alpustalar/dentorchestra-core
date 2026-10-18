import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { IssueInvoiceCommand } from './issue-invoice.command';
import { IssueInvoiceResponse } from './issue-invoice.response';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { GetTaxRateQuery } from '@modules/finance/accounting/tax-parameters/application/queries/get-tax-rate/get-tax-rate.query';
import { GetClinicGovernmentSpecsQuery } from '@modules/organization/clinic-governance/application/queries/get-clinic-government-specs/get-clinic-government-specs.query';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { QueueEDocumentCommand } from '@modules/finance/e-document/application/commands/queue-e-document/queue-e-document.command';
import { TaxSpecification } from '@modules/finance/shared/domain/value-objects/tax-specification.vo';
import {
  FinancialEventTypeSchema,
  PartyRoleSchema,
  PartyTypeSchema,
  TaxParameterKeySchema,
} from '@shared';
import { PartyTypeType as PartyType } from '@input-type-schemas/PartyTypeSchema';
import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  CHARGE_TOTALS_SERVICE,
  IChargeTotalsService,
} from '@modules/finance/treatment-charge/domain/services/charge-totals';
import { AppointmentChargeTotals } from '@modules/finance/treatment-charge/domain/value-objects/appointment-charge-totals.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import {
  IInvoiceCommandRepository,
  INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';
import { Invoice } from '@modules/finance/invoice/domain/entities/invoice.entity';
import {
  InvoiceCurrencyMismatchException,
  InvoiceDuplicateException,
} from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements ICommandHandler<
  IssueInvoiceCommand,
  IssueInvoiceResponse
> {
  private readonly logger = new Logger(IssueInvoiceHandler.name);

  constructor(
    @Inject(INVOICE_COMMAND_REPOSITORY)
    private readonly invoiceRepo: IInvoiceCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(CHARGE_TOTALS_SERVICE)
    private readonly chargeTotals: IChargeTotalsService,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<IssueInvoiceResponse> {
    const { input } = command;

    const existingInvoice = await this.resolveExisting(input);
    if (existingInvoice) {
      this.logger.log(
        `Fatura zaten mevcut, atlanıyor. invoiceId=${existingInvoice.id.value}`
      );
      return this.toResponse(existingInvoice);
    }

    const invoiceId = UUID.generate().value;
    // Fatura hem kliniğe hem organizasyona bağlıdır; org, kliniğin sahibi org'undan çözülür.
    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId: input.clinicId,
    });

    // Fatura PENDING oluşturulur ve ekonomik olay (SALES_INVOICE_ISSUED) HER ZAMAN
    // yazılır — e-belge gönderiminden bağımsız. İkisi atomik (outboxRun).
    //
    // Satır toplamı da **bu transaction içinde ve kilit altında** okunur: tutar
    // satırlardan türüyorsa okuma ile yazma arasındaki pencerede bir satır iptal
    // edilebiliyor ya da indirimi değişebiliyordu. Fatura o zaman kendi
    // satırlarıyla uyuşmayan bir tutarla kesiliyor, `assertAppointmentNotInvoiced`
    // düzeltmeyi de engellediği için fark KALICI kalıyordu.
    //
    // Mükerrer faturaya karşı nihai güvence baştaki `resolveExisting` kontrolü
    // DEĞİL, DB'deki unique kısıttır: kontrol ile yazma arasındaki pencerede ikinci
    // istek gelirse burada `InvoiceDuplicateException` alınır ve kazananın faturası
    // okunup dönülür (kilitlenecek tek bir satır yok — fatura henüz yaratılmamış).
    try {
      await this.txManager.outboxRun(async () => {
        // Randevunun fiyatlı işlem satırları varsa fatura ONLARDAN türer.
        // Satırlar liste fiyatı/indirim/KDV'yi zaten donmuş halde taşır; brüt
        // tutarı yeniden matraha bölmek (fromGrossAmount) kuruş sapması yaratır
        // ve faturayı kendi satırlarıyla tutarsız kılar. Satır yoksa serbest
        // tutarlı klasik yol işler (kapora, tedavi dışı tahsilat).
        const charges = input.appointmentId
          ? await this.chargeTotals.lockAndGetAppointmentTotals(
              input.appointmentId
            )
          : null;

        // Satırların para birimi ile tahsilatın para birimi ayrışıyorsa fatura
        // sessizce yanlış birimde kesilmesin: satırlar tutarın kaynağıdır,
        // uyuşmazlık veri tutarsızlığıdır ve kapıda durdurulur.
        const currency = this.resolveCurrency(input, charges?.currency);

        // KDV oranı yasal kümeden geçmek ZORUNDA: oranı kabul eden kapı (vergi
        // parametresi tablosu) ile oranı kullanan yer aynı listeyi zorlamalı
        // (CLAUDE.md finans kuralı 12). `TaxSpecification` jeneriktir (0–100;
        // stopaj gibi KDV dışı oranları da taşır), KDV'ye özgü kümeyi `VatRate`
        // zorlar.
        const vatRate = VatRate.create(
          charges?.vatRate ??
            input.vatRate ??
            (await this.resolveVatRate(input.clinicId))
        )
          .orThrow()
          .value.toNumber();

        const taxSpec = this.buildTaxSpec({
          input,
          charges,
          currency,
          vatRate,
        });

        // TEK zaman damgası: fatura kaydının `issuedAt`'i, defterdeki ekonomik
        // olayın `occurredAt`'i ve e-belgenin `issueDate`'i aynı an olmak zorunda.
        // Eskiden `issuedAt` NULL kaydediliyor ve ancak e-belge sonucu döndüğünde
        // (finalize) `now` ile damgalanıyordu: kuyruk beklediğinde — ya da gönderim
        // FAILED kalıp elle sonradan tamamlandığında — belge tarihi defter
        // tarihinden kopuyordu (ay/dönem dönümünde KDV beyanı ile mizan ayrışır),
        // FAILED kalırsa `issuedAt` sonsuza dek NULL kalıyordu.
        const issuedAt = DateTimeManager.create();

        await this.invoiceRepo.create({
          id: invoiceId,
          organizationId,
          clinicId: input.clinicId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          paymentId: input.paymentId,
          // Satırlardan türediyse genel toplam da satırların toplamıdır; çağıranın
          // gönderdiği tutar değil (ikisi ayrışırsa satır toplamı esastır).
          amount: taxSpec.grossAmount.value,
          currency,
          vatRate,
          netTotal: taxSpec.netAmount.value,
          vatTotal: taxSpec.taxAmount.value,
          status: InvoiceStatusSchema.enum.PENDING,
          issuedAt,
        });

        await this.recordSalesInvoiceIssued({
          invoiceId,
          clinicId: input.clinicId,
          patientId: input.patientId,
          netTotal: taxSpec.netAmount.value.toString(),
          vatTotal: taxSpec.taxAmount.value.toString(),
          grandTotal: taxSpec.grossAmount.value.toString(),
          currency,
          issuedAt,
        });
      });
    } catch (error) {
      const winner = await this.resolveDuplicateWinner(error, input);
      if (winner) return winner;
      throw error;
    }

    // e-Belge gönderimi async kuyruğa düşer (doc 07 §5); fatura/muhasebe zaten commit
    // edildiği için enqueue hatası akışı geri almaz — yalnız loglanır. Processor portu
    // çağırıp sonucu (Noop → INTERNAL) faturaya işler, fatura ISSUED'a finalize olur.
    await this.enqueueEDocument(invoiceId, input.clinicId);

    return {
      invoiceId,
      invoiceNumber: null,
      status: InvoiceStatusSchema.enum.PENDING,
    };
  }

  /**
   * Unique kısıt yarışını kaybettiysek kazananın faturasını döner; hata başka bir
   * şeyse `null` döner ve çağıran hatayı yükseltir.
   *
   * Kaybeden tarafın transaction'ı komple geri sarıldığı için (fatura + muhasebe
   * olayı birlikte) ortada yarım kayıt kalmaz; kazananın kaydı zaten commit'lidir.
   */
  private async resolveDuplicateWinner(
    error: unknown,
    input: IssueInvoiceCommand['input']
  ): Promise<IssueInvoiceResponse | null> {
    if (!(error instanceof InvoiceDuplicateException)) return null;

    const winner = await this.resolveExisting(input);
    if (!winner) throw error;

    this.logger.warn(
      `Fatura yarışı kaybedildi (eşzamanlı istek); mevcut fatura dönülüyor. invoiceId=${winner.id.value}`
    );
    return this.toResponse(winner);
  }

  private toResponse(invoice: Invoice): IssueInvoiceResponse {
    return {
      invoiceId: invoice.id.value,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
    };
  }

  /** e-Belge gönderimini kuyruğa alır; entegratör akışı faturayı bloklamaz. */
  private async enqueueEDocument(
    invoiceId: string,
    clinicId: string
  ): Promise<void> {
    try {
      await this.commandBus.execute(new QueueEDocumentCommand(invoiceId));
    } catch (error) {
      this.logger.error(
        `e-Belge kuyruğa alınamadı: invoiceId=${invoiceId}`,
        error
      );
      // Fatura commit edildi ama e-belge işi kuyruğa hiç girmedi: fatura
      // PENDING'de kalır, GİB'e giden bir belge olmaz ve tekrar deneyecek bir
      // iş de yoktur — elle tetiklenmesi gerekir.
      this.criticalFailure.publish({
        operation: 'finance.e-document.enqueue',
        severity: 'CRITICAL',
        summary: 'Fatura kesildi ancak e-belge gönderimi kuyruğa alınamadı.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: { invoiceId, clinicId },
        clinicId,
        dedupeKey: `edocument-enqueue-failed:${invoiceId}`,
      });
    }
  }

  /**
   * Faturanın para birimi. Satır özeti varsa onun para birimi esastır (tutarın
   * kaynağı o); tahsilatın para birimiyle ayrışıyorsa bu bir veri tutarsızlığıdır
   * ve sessizce birini seçmek yerine kapıda durdurulur.
   */
  private resolveCurrency(
    input: IssueInvoiceCommand['input'],
    chargesCurrency?: CurrencyType
  ): CurrencyType {
    const paymentCurrency = input.totalAmount.currency;

    if (chargesCurrency && chargesCurrency !== paymentCurrency) {
      throw new InvoiceCurrencyMismatchException({
        chargesCurrency,
        paymentCurrency,
      });
    }

    return chargesCurrency ?? paymentCurrency;
  }

  /**
   * Faturanın matrah/KDV ayrımı. Satır toplamı varsa ondan **birebir** taşınır
   * (brüt tutarı yeniden bölmek kuruş sapması üretir); yoksa çağıranın
   * gönderdiği brüt tutar orana göre ayrıştırılır.
   */
  private buildTaxSpec(input: BuildTaxSpecInput): TaxSpecification {
    if (!input.charges) {
      return TaxSpecification.fromGrossAmount(
        input.input.totalAmount,
        input.vatRate
      );
    }

    // Satırlar otorite: KDV yasal olarak satır bazında yuvarlanır, bu yüzden
    // satır toplamı `netTotal × oran`dan meşru biçimde ayrışır. İzin verilen pay
    // satır sayısından türer (`lineCount × 0,005`) — sabit bir tolerans satır
    // sayısından habersiz olduğu için çok satırlı faturayı reddediyordu.
    return TaxSpecification.fromLineTotals({
      netAmount: Money.fromTrusted(
        input.charges.netTotal.value,
        input.currency
      ),
      taxRate: input.vatRate,
      taxAmount: Money.fromTrusted(
        input.charges.vatTotal.value,
        input.currency
      ),
      lineCount: input.charges.lineCount,
    });
  }

  /** Şubenin bugün geçerli sağlık hizmeti KDV oranını parametrik tablodan çözer. */
  private async resolveVatRate(clinicId: string): Promise<number> {
    const { data } = await this.queryBus.execute(
      new GetTaxRateQuery(
        clinicId,
        TaxParameterKeySchema.enum.VAT_HEALTH,
        DateTimeManager.create()
      )
    );
    return data.rate;
  }

  private async resolveExisting(input: IssueInvoiceCommand['input']) {
    if (input.appointmentId) {
      return this.invoiceRepo.findByAppointmentId(input.appointmentId);
    }
    if (input.paymentId) {
      return this.invoiceRepo.findByPaymentId(input.paymentId);
    }
    return null;
  }

  /**
   * Faturayı muhasebe katmanına köprüler: hastanın carisini garanti eder ve
   * SALES_INVOICE_ISSUED ekonomik olayını yazar. dedupeKey ile idempotenttir;
   * olay Outbox'a düşer, posting listener'ı fişi (120 / 600.xx + 391) üretir.
   *
   * Bilinçli olarak try-catch YOK: bu çağrı üstteki outboxRun transaction'ının
   * içinde koşar; köprü (party / financial_event) hata verirse fatura da dahil
   * her şey rollback olmalıdır. Hatayı yutmak sessiz mutabakat kaybı yaratır
   * (fatura kesilir, muhasebe fişi yazılmaz). Komut baştaki resolveExisting +
   * dedupeKey sayesinde idempotenttir; başarısızlıkta çağıran güvenle retry eder.
   */
  private async recordSalesInvoiceIssued(
    input: RecordSalesInvoiceIssuedInput
  ): Promise<void> {
    const ctx = ExecutionContextFactory.createInternal();

    const { partyId } = await this.commandBus.execute(
      new EnsurePartyForPatientCommand(
        input.patientId,
        input.clinicId,
        PartyRoleSchema.enum.CUSTOMER,
        ctx
      )
    );

    // Hasta cari = nihai tüketici (INDIVIDUAL). SMM stopajı yalnız ödeyen vergi
    // sorumlusu (COMPANY) ise yapılır (doc 05 §2.1, 06 §3); helper INDIVIDUAL'da
    // erken çıkar (ekstra sorgu yok). Kurumsal-ödeyen faturalama gelince aktifleşir.
    const withholdingTotal = await this.resolveSmmWithholding({
      clinicId: input.clinicId,
      payerType: PartyTypeSchema.enum.INDIVIDUAL,
      netTotal: input.netTotal,
      ctx,
    });

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: input.clinicId,
          type: FinancialEventTypeSchema.enum.SALES_INVOICE_ISSUED,
          occurredAt: input.issuedAt,
          payload: {
            partyId,
            netTotal: input.netTotal,
            vatTotal: input.vatTotal,
            grandTotal: input.grandTotal,
            // Para birimi olaya MUTLAKA geçer: posting `draft.currency ?? fonksiyonel`
            // diyor, yani eksik bırakılırsa 1.000 EUR'luk fatura deftere 1.000 TRY
            // olarak düşer ve kur çevrimi (Model A) hiç tetiklenmez.
            currency: input.currency,
            ...(withholdingTotal ? { withholdingTotal } : {}),
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.INVOICE,
          sourceRefId: input.invoiceId,
          dedupeKey: FinancialEventDedupeKeys.sales_invoice(input.invoiceId),
        },
        ctx
      )
    );
  }

  /**
   * SMM (serbest meslek) gelir vergisi stopajını çözer. Yalnız ödeyen vergi
   * sorumlusu (COMPANY) + klinik SERBEST_MESLEK ise stopaj = net × WHT oranı.
   * INDIVIDUAL ödeyen (nihai tüketici) erken çıkar — governance/vergi sorgusu yapılmaz.
   */
  private async resolveSmmWithholding(
    input: ResolveSmmWithholdingInput
  ): Promise<string | undefined> {
    if (input.payerType !== PartyTypeSchema.enum.COMPANY) return undefined;

    const { data: specs } = await this.queryBus.execute(
      new GetClinicGovernmentSpecsQuery(input.clinicId, input.ctx)
    );
    if (specs?.legalType !== 'SERBEST_MESLEK') return undefined;

    const { data: wht } = await this.queryBus.execute(
      new GetTaxRateQuery(
        input.clinicId,
        TaxParameterKeySchema.enum.WHT_SELF_EMPLOYMENT,
        DateTimeManager.create()
      )
    );

    return new Decimal(input.netTotal).mul(wht.rate).div(100).toFixed(2);
  }
}

interface RecordSalesInvoiceIssuedInput {
  invoiceId: string;
  clinicId: string;
  patientId: string;
  netTotal: string;
  vatTotal: string;
  grandTotal: string;
  currency: CurrencyType;
  issuedAt: Date;
}

interface ResolveSmmWithholdingInput {
  clinicId: string;
  payerType: PartyType;
  netTotal: string;
  ctx: IGetContext;
}

interface BuildTaxSpecInput {
  input: IssueInvoiceCommand['input'];
  charges: AppointmentChargeTotals | null;
  currency: CurrencyType;
  vatRate: number;
}
