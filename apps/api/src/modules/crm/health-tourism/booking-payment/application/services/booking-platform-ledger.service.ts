import { Inject, Injectable, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
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
  PlatformReturnableChargeEventPayload,
} from '@modules/finance/accounting/posting/domain/posting/event-payloads';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
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
  /** Ekonomik olayın tarihi; verilmezse "şimdi". İade, sağlayıcıda gerçekleştiği günle yazılır. */
  readonly occurredAt?: Date;
}

/**
 * Müşteriye iade edilecek tahsilat (çift çekim / başarısız rezervasyon):
 * `RECEIVED` = `B 108 / A 336`, `REFUNDED` = `B 336 / A 108`.
 */
export type ReturnableChargeLedgerKind =
  | 'RETURNABLE_RECEIVED'
  | 'RETURNABLE_REFUNDED';

export interface ReturnableChargeLedgerInput {
  readonly kind: ReturnableChargeLedgerKind;
  readonly refund: BookingPaymentRefund;
  /** Tahsilatın düştüğü an (RECEIVED tarihi): başarısız rezervasyonda `paidAt`, çift çekimde talep anı. */
  readonly receivedAt?: Date | null;
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
          ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BOOKING_PAYMENT,
          sourceRefId: bp.id.value,
          dedupeKey: recorded.dedupeKey,
        },
        ctx
      )
    );
  }

  // ---- Müşteriye iade edilecek tahsilat (336) ------------------------------------

  /**
   * Bu iade 336 yolundan deftere girer mi? Yalnız iade edilecek tahsilatlar (çift çekim,
   * başarısız rezervasyon) ve yalnız iyzico/TRY: Stripe bu akışa bilinçli alınmadı (kapalı,
   * kur farkı tanınmıyor). Rezervasyonun KENDİ tahsilatının iptal iadesi `REFUNDED` fişine
   * gider, 336'ya değil.
   */
  isReturnableLedgerable(refund: BookingPaymentRefund): boolean {
    return (
      refund.kind !== 'CANCELLATION' &&
      refund.provider === 'IYZICO' &&
      refund.amount.currency === 'TRY'
    );
  }

  /**
   * Bu iadenin ters kaydının olay defterindeki idempotency anahtarı; ters kayıt bu yoldan hiç
   * yazılmayacaksa (Stripe 336) `null`. "İade gerçekleşmedi" kararı bu anahtarın var olup
   * olmadığına bakar: yazılmış bir fişi geri almak storno demektir (muhasebe kararı).
   */
  reversalDedupeKey(refund: BookingPaymentRefund): string | null {
    if (refund.kind === 'CANCELLATION') {
      return FinancialEventDedupeKeys.platform_booking_refunded(
        refund.bookingPaymentId.value
      );
    }
    if (!this.isReturnableLedgerable(refund)) return null;
    return FinancialEventDedupeKeys.platform_returnable_charge_refunded(
      refund.provider,
      refund.chargeProviderRef
    );
  }

  /**
   * 336 fişini yazar ve **hata fırlatır** (telafi komutu için). İade yazılırken önce
   * `RECEIVED` denenir: dedupe tekrarı mükerrer yazmaz, ama 336 açılmadan kapanamaz
   * (kural 16 — kapanış, açılış olmadan "yetim" fiş olurdu).
   */
  async recordReturnable(input: ReturnableChargeLedgerInput): Promise<void> {
    const { refund } = input;
    if (!this.isReturnableLedgerable(refund)) return;

    const target = await this.platformTenant.resolve();
    const ctx = this.buildPlatformContext(target);

    if (input.kind === 'RETURNABLE_REFUNDED') {
      await this.writeReturnable({
        kind: 'RETURNABLE_RECEIVED',
        refund,
        target,
        ctx,
        occurredAt: input.receivedAt ?? refund.requestedAt ?? undefined,
      });
    }

    await this.writeReturnable({
      kind: input.kind,
      refund,
      target,
      ctx,
      occurredAt:
        input.kind === 'RETURNABLE_REFUNDED'
          ? (refund.refundedAt ?? undefined)
          : (input.receivedAt ?? refund.requestedAt ?? undefined),
    });
  }

  /** Para hareketi çoktan olmuş/başlamış: muhasebe hatası iadeyi durdurmaz, alarmla insana gider. */
  async recordReturnableBestEffort(
    input: ReturnableChargeLedgerInput
  ): Promise<void> {
    const { refund, kind } = input;
    try {
      await this.recordReturnable(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Platform defterine ${kind} kaydı yazılamadı (refund=${refund.id.value}): ${message}`
      );
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.platform-ledger',
        severity: 'CRITICAL',
        summary:
          kind === 'RETURNABLE_RECEIVED'
            ? "Müşteriye iade edilecek tahsilat (336) platform defterine yazılamadı: 108 payout'ta görünen parayı göstermiyor."
            : 'Müşteriye iade edilen tahsilatın kapanış fişi (B 336 / A 108) yazılamadı: 336 açık kalıyor.',
        errorMessage: message,
        context: { refundId: refund.id.value, kind },
        clinicId: refund.clinicId.value,
        dedupeKey: `booking-platform-ledger-failed:${kind}:${refund.id.value}`,
      });
    }
  }

  private async writeReturnable(params: {
    kind: ReturnableChargeLedgerKind;
    refund: BookingPaymentRefund;
    target: PlatformLedgerTarget;
    ctx: IGetContext;
    occurredAt?: Date;
  }): Promise<void> {
    const { kind, refund, target, ctx, occurredAt } = params;

    // `satisfies`: sözleşmeye uygunluk derleyicide doğrulanır, literal tip korunur.
    const payload = {
      amount: refund.amount.toApiFormat(),
      currency: refund.amount.currency,
      provider: refund.provider,
      chargeReference: refund.chargeProviderRef,
      reason: refund.kind,
      bookingPaymentId: refund.bookingPaymentId.value,
      refundId: refund.id.value,
    } satisfies PlatformReturnableChargeEventPayload;

    const received = kind === 'RETURNABLE_RECEIVED';

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: target.clinicId,
          type: received
            ? FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_RECEIVED
            : FinancialEventTypeSchema.enum.PLATFORM_RETURNABLE_CHARGE_REFUNDED,
          payload,
          ...(occurredAt ? { occurredAt } : {}),
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BOOKING_PAYMENT,
          sourceRefId: refund.bookingPaymentId.value,
          dedupeKey: received
            ? FinancialEventDedupeKeys.platform_returnable_charge_received(
                refund.provider,
                refund.chargeProviderRef
              )
            : FinancialEventDedupeKeys.platform_returnable_charge_refunded(
                refund.provider,
                refund.chargeProviderRef
              ),
        },
        ctx
      )
    );
  }

  /**
   * İade sağlayıcıda DOĞRULANDI (otomatik ya da elle): defter paranın gerçekliğini göstersin.
   * Rezervasyonun kendi tahsilatının iptal iadesi → `REFUNDED` fişi (+ bilinmeyen ceza
   * uyarısı); çift çekim / başarısız rezervasyon → `B 336 / A 108`.
   */
  async bridgeConfirmedRefundBestEffort(params: {
    refund: BookingPaymentRefund;
    bp: BookingPayment;
  }): Promise<void> {
    const { refund, bp } = params;

    if (refund.kind === 'CANCELLATION') {
      await this.recordBestEffort({
        kind: 'REFUNDED',
        bp,
        provider: refund.provider,
        ...(refund.refundedAt ? { occurredAt: refund.refundedAt } : {}),
      });
      // Ceza bilinmiyorsa defter cezasız ters kayıt yazdı: 320'de sağlayıcının yine
      // faturalayacağı tutar kadar eksik düşüm kalır. Eşik yok — bir kuruş fark da
      // sağlayıcı mutabakatında açık demektir.
      this.alertOnUnknownRetainedCost(bp);
      return;
    }

    await this.recordReturnableBestEffort({
      kind: 'RETURNABLE_REFUNDED',
      refund,
      receivedAt: refund.kind === 'BOOKING_FAILED' ? bp.paidAt : undefined,
    });
  }

  /**
   * Sağlayıcının alıkoyduğu cezanın öğrenilemediği hâlleri duyurur.
   *
   * Neden yasaklamak yerine duyurmak: cezayı bilmeden ters kayıt yazmamak 108'i (giden
   * para), 601'i (kazanılmamış komisyon) ve 320'yi (artık olmayan borç) birlikte yanlış
   * bırakırdı. Cezasız varsayım yalnız 320'yi eksik bırakır — üç hesap yerine bir hesap.
   * Varsayımın bedeli bu alarmla görünür.
   */
  private alertOnUnknownRetainedCost(bp: BookingPayment): void {
    const refund = bp.refundAssessment;
    if (refund.retainedKnown) return;

    this.criticalFailure.publish({
      operation: 'health-tourism.booking-payment.cancellation-cost',
      severity: 'WARNING',
      summary: refund.retainedCurrencyMismatch
        ? 'Sağlayıcı iptal cezasını farklı para biriminde bildirdi; ters kayıt cezasız yazıldı (320 eksik düşmüş olabilir).'
        : 'Sağlayıcı iptal cezasını bildirmedi; ters kayıt cezasız yazıldı (320 eksik düşmüş olabilir).',
      errorMessage: null,
      context: {
        bookingPaymentId: bp.id.value,
        bookingType: bp.bookingType,
        retainedReported: bp.supplierRetained?.toApiFormat() ?? null,
        retainedCurrency: bp.supplierRetained?.currency ?? null,
        supplierPosted: bp.supplierCost.ledgerAmount.toApiFormat(),
        saleCurrency: bp.saleCurrency.value,
      },
      clinicId: bp.clinicId.value,
      dedupeKey: `booking-retained-unknown:${bp.id.value}`,
    });
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
