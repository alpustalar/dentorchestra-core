import { Inject, Injectable, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { FinancialEventTypeSchema } from '@shared';
import { PartyOriginTypeSchema } from '@input-type-schemas/PartyOriginTypeSchema';
import { PartyRoleSchema } from '@input-type-schemas/PartyRoleSchema';
import { PartyTypeSchema } from '@input-type-schemas/PartyTypeSchema';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
  PlatformLedgerTarget,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import {
  PlatformBookingRefundedEventPayload,
  PlatformBookingSettledEventPayload,
} from '@modules/finance/accounting/posting/domain/posting/event-payloads';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentProviderValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { resolveBookingSupplier } from '@modules/crm/health-tourism/booking-payment/domain/constants/booking-supplier.constant';
import { BookingLedgerNotPostableException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';

/**
 * Köprünün yönü. İleri yol (tahsilat) ve geri yol (iade) **aynı serviste**
 * durur: ikisini ayrı yerlere koymak, birinin cari çözümlemesini ya da
 * platform defteri hedefini kazanıp diğerinin kaybetmesine yol açıyor
 * (POS köprüsünde ölçülen hata: ters kayıt yolu köprüye hiç uğramıyordu).
 */
export type BookingLedgerKind = 'SETTLED' | 'REFUNDED';

export interface BookingLedgerInput {
  readonly kind: BookingLedgerKind;
  readonly bp: BookingPayment;
  /** Tahsilatın/iadenin geçtiği kanal (IYZICO | STRIPE) — fiş açıklaması. */
  readonly provider: BookingPaymentProviderValue;
}

/**
 * Sağlık turizmi rezervasyonunun **platform defterine** köprüsü.
 *
 * Klinik defterine yazılmaz: hasta platforma öder, platform sağlayıcıya öder ve
 * komisyon platform geliridir — klinik bu işleme finansal olarak taraf değildir.
 *
 * Bilerek **best-effort**: buraya gelindiğinde para hareket etmiş ve rezervasyon
 * açılmış/iptal edilmiştir. Muhasebe kaydı atılamadı diye hata fırlatmak,
 * çağıranın telafi dalını tetikleyip başarılı bir işlemi geri almaya çalışırdı.
 * `dedupeKey` tekrarı mükerrer yazmaz; başarısızlık CRITICAL ile duyurulur.
 */
@Injectable()
export class BookingPlatformLedgerService {
  private readonly logger = new Logger(BookingPlatformLedgerService.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  /**
   * Köprüyü kurar ve **hata fırlatır**. Telafi komutu bunu çağırır: hangi
   * hareketin neden yazılamadığını satır satır bilmesi gerekiyor.
   */
  async record(input: BookingLedgerInput): Promise<void> {
    const { kind, bp } = input;

    const target = await this.platformTenant.resolve();
    const ctx = this.buildPlatformContext(target);

    // 320 `requiresParty` taşır: tedarikçi carisi olmadan satır fişe
    // dönüşmez. Cari olay YAZILMADAN ÖNCE garanti edilir, çünkü gövdeye
    // partyId girmezse olay append-only deftere **hiç postlanamayacak**
    // hâlde yazılır ve her süpürmede aynı hatayla patlar.
    const supplierPartyId = await this.ensureSupplierParty(bp, target, ctx);

    const recorded =
      kind === 'SETTLED'
        ? this.buildSettled(input, supplierPartyId)
        : this.buildRefunded(input, supplierPartyId);

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: target.clinicId,
          type: recorded.type,
          payload: recorded.payload,
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BOOKING_PAYMENT,
          sourceRefId: bp.id.value,
          dedupeKey: recorded.dedupeKey,
        },
        ctx
      )
    );
  }

  /**
   * İleri/geri akışların çağırdığı hâli: hata **yükselmez**.
   *
   * Bilerek best-effort: buraya gelindiğinde para hareket etmiş ve rezervasyon
   * açılmış/iptal edilmiştir. Muhasebe kaydı atılamadı diye hata fırlatmak,
   * çağıranın telafi dalını tetikleyip başarılı bir işlemi geri almaya
   * çalışırdı. `dedupeKey` tekrarı mükerrer yazmaz; eksik kalan iş
   * `find-unbridged-booking-ledger-entries` + `backfill-booking-ledger-entries`
   * ile görünür ve onarılabilir (CLAUDE.md finans kuralı 4).
   */
  async recordBestEffort(input: BookingLedgerInput): Promise<void> {
    const { kind, bp } = input;

    try {
      await this.record(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Platform defterine ${kind} kaydı yazılamadı (bp=${bp.id.value}): ${message}`
      );
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.platform-ledger',
        severity: 'CRITICAL',
        summary: this.failureSummary(input, err),
        errorMessage: message,
        context: { bookingPaymentId: bp.id.value, kind },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-platform-ledger-failed:${kind}:${bp.id.value}`,
      });
    }
  }

  /**
   * Alarm metni tek yerde: "yazılamadı" ile "yazılamaz" ayrı şeylerdir.
   * İkincisi (fişi matematiksel olarak imkânsız kılan hâl) bir muhasebe kararı
   * bekler, yeniden deneme onu çözmez.
   */
  private failureSummary(input: BookingLedgerInput, err: unknown): string {
    if (err instanceof BookingLedgerNotPostableException) {
      return err.message;
    }

    return input.kind === 'SETTLED'
      ? 'Rezervasyon tahsilatı platform defterine yazılamadı (komisyon/tedarikçi kaydı eksik).'
      : 'Rezervasyon iadesi platform defterine yazılamadı: 108 giden parayı, 601 kazanılmamış komisyonu, 320 artık olmayan borcu göstermeye devam ediyor.';
  }

  /**
   * Tahsilat fişi: B 108 / A 601 + A 320.
   *
   * Tutarlar entity'den **fiş para biriminde** gelir: satış EUR olsa bile
   * iyzico hastadan TRY çeker ve 108 satırı fiilen giren parayı göstermek
   * zorundadır (bkz. `BookingPayment.settledLedgerAmounts`). Burada para
   * aritmetiği yapılmaz — `sale.minus(supplier)` ham `Decimal` üzerinde
   * yürüdüğü için `Money`'nin para birimi guard'ını baypas ediyordu: iki
   * tutarın aynı cinsten olduğunu garanti eden kural **başka bir sınıfta**
   * yaşıyordu ve çıkarmanın kendisi onu göremiyordu.
   */
  private buildSettled(input: BookingLedgerInput, supplierPartyId: string) {
    const { bp, provider } = input;
    const amounts = bp.settledLedgerAmounts;

    // `satisfies`: sözleşmeye uygunluk derleyicide doğrulanır ama literal tipi
    // korunur — `Record<string, unknown>`'a genişletmek olayın JSON payload
    // tipiyle (InputJsonValue) uyuşmuyor.
    const payload = {
      saleAmount: amounts.sale.toApiFormat(),
      supplierAmount: amounts.supplier.toApiFormat(),
      commission: amounts.commission.toApiFormat(),
      supplierPartyId,
      currency: amounts.currency,
      bookingType: bp.bookingType,
      provider,
      ...(amounts.fxRate && amounts.originalCurrency && amounts.supplierOriginal
        ? {
            originalCurrency: amounts.originalCurrency,
            fxRate: amounts.fxRate.toFixed(6),
            supplierOriginalAmount: amounts.supplierOriginal.toApiFormat(),
          }
        : {}),
    } satisfies PlatformBookingSettledEventPayload;

    return {
      type: FinancialEventTypeSchema.enum.PLATFORM_BOOKING_SETTLED,
      payload,
      dedupeKey: FinancialEventDedupeKeys.platform_booking_settled(bp.id.value),
    };
  }

  /**
   * İade fişi: B 610 + B 320 + B 689 / A 108.
   *
   * İki hâlde gövde üretilmez, **adıyla hata fırlatılır** — ikisi de fişi
   * matematiksel olarak imkânsız kılar ve olay defteri append-only olduğu için
   * yazılan gövde düzeltilemez (sonsuza dek fişsiz kalır, her süpürmede aynı
   * hatayla patlar):
   *   1. Komisyon negatif → tahsilat fişi de hiç yazılmamıştı (maliyetin
   *      altında satış); olmayan bir fişi ters kaydetmek 108'i eksiye düşürür.
   *   2. Alıkoyulan ceza tedarikçi maliyetini aşıyor → 320 negatife düşer.
   * İkisi de muhasebe kararı ister (kural 11), bu yüzden alarmla insana gider.
   */
  private buildRefunded(input: BookingLedgerInput, supplierPartyId: string) {
    const { bp, provider } = input;
    const refund = bp.refundAssessment;

    if (refund.commissionIsNegative || refund.retainedExceedsSupplier) {
      throw new BookingLedgerNotPostableException({
        bookingPaymentId: bp.id.value,
        reason: refund.commissionIsNegative
          ? 'BELOW_COST'
          : 'RETAINED_EXCEEDS_SUPPLIER',
        refundAmount: refund.refundAmount.toApiFormat(),
        supplierPosted: bp.supplierCost.ledgerAmount.toApiFormat(),
        retainedLoss: refund.retainedLoss.toApiFormat(),
      });
    }

    // Tahsilatla aynı gerekçe: tutarlar paranın fiilen geri gittiği cinsten.
    const amounts = bp.refundedLedgerAmounts;

    const payload = {
      refundAmount: amounts.refundAmount.toApiFormat(),
      commission: amounts.commission.toApiFormat(),
      supplierReleased: amounts.supplierReleased.toApiFormat(),
      retainedLoss: amounts.retainedLoss.toApiFormat(),
      supplierPartyId,
      currency: amounts.currency,
      bookingType: bp.bookingType,
      provider,
      ...(amounts.fxRate &&
      amounts.originalCurrency &&
      amounts.supplierReleasedOriginal &&
      amounts.retainedLossOriginal
        ? {
            originalCurrency: amounts.originalCurrency,
            fxRate: amounts.fxRate.toFixed(6),
            supplierReleasedOriginalAmount:
              amounts.supplierReleasedOriginal.toApiFormat(),
            retainedLossOriginalAmount:
              amounts.retainedLossOriginal.toApiFormat(),
          }
        : {}),
    } satisfies PlatformBookingRefundedEventPayload;

    return {
      type: FinancialEventTypeSchema.enum.PLATFORM_BOOKING_REFUNDED,
      payload,
      dedupeKey: FinancialEventDedupeKeys.platform_booking_refunded(
        bp.id.value
      ),
    };
  }

  /**
   * Tedarikçi carisi. Kaynak tipi `EXTERNAL`: HotelBeds/Duffel satın alma
   * modülünün `Supplier` kaydı değil, dış bir sağlayıcıdır — `originId` sabit
   * anahtardır, böylece aynı sağlayıcı her rezervasyonda aynı cariye düşer.
   */
  private ensureSupplierParty(
    bp: BookingPayment,
    target: PlatformLedgerTarget,
    ctx: IGetContext
  ): Promise<string> {
    const supplier = resolveBookingSupplier(bp.bookingType);

    return this.commandBus.execute(
      new EnsurePartyCommand(
        {
          clinicId: target.clinicId,
          organizationId: target.organizationId,
          originType: PartyOriginTypeSchema.enum.EXTERNAL,
          originId: supplier.originId,
          role: PartyRoleSchema.enum.SUPPLIER,
          type: PartyTypeSchema.enum.COMPANY,
          name: supplier.name,
        },
        ctx
      )
    );
  }

  /** Platform defterine yazarken kullanılacak sistem context'i. */
  private buildPlatformContext(target: PlatformLedgerTarget): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId: target.clinicId,
      organizationId: target.organizationId,
      managedClinics: [{ id: target.clinicId }],
    };

    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'BOOKING_PLATFORM_LEDGER',
    };
  }
}
