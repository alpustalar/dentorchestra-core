import { Decimal } from 'decimal.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import {
  IPaymentLinkProvider,
  IYZICO_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK,
} from '@src/infrastructure/payment/links/payment-link.port';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  BookingPaymentProviderValue,
  Currency as CurrencyValue,
  FlightInstantBookingIntent,
  HotelBookingIntent,
  TransferBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPaymentNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentRefundExecutor } from '@modules/crm/health-tourism/booking-payment/application/services/booking-payment-refund.executor';
import { BookHotelCommand } from '@modules/crm/health-tourism/hotel/application/commands/book-hotel/book-hotel.command';
import { BookTransferCommand } from '@modules/crm/health-tourism/transfer/application/commands/book-transfer/book-transfer.command';
import { BookFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/book-flight/book-flight.command';
import { PayHeldFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/pay-held-flight/pay-held-flight.command';
import {
  BookFlightDto,
  BookHotelDto,
  BookTransferDto,
} from '@shared/modules/health-tourism/dto/commands';
import { assertNever } from '@common/utils';
import { ClientProxy } from '@nestjs/microservices';
import {
  BookingConfirmedEventPayload,
  NATS_CLIENT,
  NATS_SUBJECTS,
} from '@src/transport';
import { ConfirmBookingPaymentCommand } from './confirm-booking-payment.command';
import { PaymentProviders } from '@common/constants';
import { BookingPaymentTypeSchema } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  CARD_CHARGEBACK_EXPOSURE_GUARD,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { BookingPlatformLedgerService } from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';

/**
 * Sağlayıcıda açılan rezervasyonun yerel kimliği **ve** sağlayıcının fiilen
 * ücretlendirdiği maliyet. Maliyet buradan dönmezse satışın altında kalan bir
 * rezervasyon sessizce komisyonu yer; defter de teklif tutarını tedarikçi borcu
 * olarak yazıp sağlayıcı faturasıyla hiç mutabık kalmaz.
 */
type BookedSupplierResult = {
  readonly bookingId: string;
  readonly supplierAmount: string;
  readonly supplierCurrency: CurrencyValue;
};

/** Kilitli claim adımının sonucu: ödeme bu webhook tarafından mı sahiplenildi? */
type PaymentClaim =
  | { readonly claimed: true; readonly bp: BookingPayment }
  | { readonly claimed: false; readonly bp: BookingPayment };

@CommandHandler(ConfirmBookingPaymentCommand)
export class ConfirmBookingPaymentHandler implements ICommandHandler<
  ConfirmBookingPaymentCommand,
  void
> {
  private readonly logger = new Logger(ConfirmBookingPaymentHandler.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    @Inject(IYZICO_PAYMENT_LINK)
    private readonly iyzicoLink: IPaymentLinkProvider,
    @Inject(STRIPE_PAYMENT_LINK)
    private readonly stripeLink: IPaymentLinkProvider,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(NATS_CLIENT)
    private readonly natsClient: ClientProxy,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    @Inject(CARD_CHARGEBACK_EXPOSURE_GUARD)
    private readonly chargebackExposureGuard: ICardChargebackExposureGuard,
    private readonly refundExecutor: BookingPaymentRefundExecutor,
    private readonly platformLedger: BookingPlatformLedgerService,
    private readonly txManager: TransactionManager,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  /**
   * Akış üç parçaya bölünmüştür: **claim-tx** (kilitli PENDING→PAID sahiplenmesi),
   * **dış çağrılar** (HotelBeds book / link expire / iade — kilit dışında) ve
   * **finalize-tx** (sonucun kilitli yazılması).
   *
   * Neden bölündü: sağlayıcı webhook'u tekrar gönderilebilir ve iki ödeme linki de
   * ödenebilir. Durum okuması kilitsiz yapılırsa iki eşzamanlı webhook da kaydı
   * "beklemede" görüp ikisi de rezervasyon açar. Kilit yalnız sahiplenme adımını
   * kapsar; saniyeler süren HotelBeds çağrısı satır kilidini (ve tx bağlantısını)
   * tutmaz.
   */
  async execute(command: ConfirmBookingPaymentCommand): Promise<void> {
    const { bookingPaymentId, provider, providerRef } = command.input;

    const claim = await this.claimPayment(command);

    // Bu bildirim ödemeyi sahiplenemedi. İki ayrı olgu var ve ayırt edici YEREL
    // DURUM DEĞİL, ÖDEME REFERANSIDIR (bkz. handleUnclaimedPayment).
    if (!claim.claimed) {
      await this.handleUnclaimedPayment({
        bp: claim.bp,
        provider,
        providerRef,
      });
      return;
    }

    const paid = claim.bp;

    // Diğer linki geçersiz kıl (best-effort).
    await this.expireOtherLink(provider, paid);

    // intent'i HotelBeds'e replay et.
    try {
      const result = await this.book(paid);
      // Rezervasyon damgası ile FİİLÎ maliyet damgası aynı transaction'da atılır:
      // ikisini ayırmak, araya düşen bir çökmede "rezervasyon açıldı ama maliyeti
      // bilinmiyor" satırı bırakır ve defter sessizce teklif tutarına düşer.
      const booked = await this.mutateInTx(bookingPaymentId, (bp) => {
        bp.markBooked(result.bookingId, result.bookingId);
        bp.recordSupplierCost({
          amount: result.supplierAmount,
          currency: result.supplierCurrency,
        });
      });
      this.logger.log(
        `Rezervasyon tamamlandı (bp=${bookingPaymentId}, bookingId=${result.bookingId}).`
      );
      // Teklif ↔ fiilî maliyet sapması: defter fiilî tutardan yazılır ama fark
      // bir fiyat/teklif sorununun belirtisidir, sessiz kalmaz.
      this.alertOnSupplierCostDrift(booked);
      // Tahsilat kliniğin defterine YAZILMAZ; platform defterine yazılır. Otel/transfer
      // bir platform işlemidir (hasta platforma öder, platform HotelBeds'e öder) ve
      // komisyon platform geliridir — klinik bu işleme finansal olarak taraf değildir.
      await this.platformLedger.recordBestEffort({
        kind: 'SETTLED',
        bp: booked,
        provider,
      });
      // Müşteriye mesajlaşma kanalından onay (AI dilinde / pencere dışı HSM); hatası bozmaz.
      this.notifyCustomer(booked);
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Rezervasyon başarısız';
      this.logger.error(
        `HotelBeds rezervasyonu başarısız (bp=${bookingPaymentId}): ${reason}`
      );
      // Tahsil edildi ama rezervasyon açılamadı → ödemeyi iade et. FAILED damgası ile PENDING
      // iade satırı AYNI transaction'da yazılır: ayırmak, araya düşen bir çökmede "FAILED ama
      // iadesi hiç talep edilmemiş" satırı bırakır. Sağlayıcı çağrısı kilit dışında.
      const refund = await this.failAndClaimRefund({
        bookingPaymentId,
        provider,
        providerRef,
        reason,
      });
      if (!refund) return;

      // Executor fırlatmaz: sağlayıcı reddederse FAILED, sonuç bilinmezse UNCONFIRMED olur
      // (ikisi de CRITICAL basar) ve ters fiş YAZILMAZ. `retained: null` — iptal diye bir şey
      // olmadı: rezervasyon hiç açılmadı, sağlayıcının alıkoyacağı bir tutar yok. Platform
      // defterine `REFUNDED` fişi de yazılmaz çünkü ileri fiş (`PLATFORM_BOOKING_SETTLED`)
      // hiç yazılmamıştı; yalnız tahsilat 336'da açılıp iade onaylanınca kapanır.
      try {
        await this.refundExecutor.execute(refund);
      } catch (refundErr) {
        this.logger.error(
          `İade yürütülemedi (bp=${bookingPaymentId}); satır PENDING kaldı, takılınca "bekleyen iadeler"de görünür: ${
            refundErr instanceof Error ? refundErr.message : refundErr
          }`
        );
        this.criticalFailure.publish({
          operation: 'health-tourism.booking-payment.refund',
          severity: 'CRITICAL',
          summary:
            'Tahsilat alındı, rezervasyon açılamadı ve iade yürütülürken beklenmeyen hata oluştu — iade satırı PENDING kaldı, elle takip gerekiyor.',
          errorMessage:
            refundErr instanceof Error ? refundErr.message : String(refundErr),
          context: {
            bookingPaymentId,
            provider,
            providerRef,
            refundId: refund.id.value,
            bookingFailureReason: reason,
          },
          clinicId: refund.clinicId.value,
          dedupeKey: `booking-refund-failed:${bookingPaymentId}`,
        });
      }
    }
  }

  /**
   * Rezervasyonu FAILED yapar ve aynı tx'te `BOOKING_FAILED` iade satırını PENDING açar.
   * Aynı tahsilat için iade zaten talep edilmişse (tekrar teslim) `null` döner.
   */
  private async failAndClaimRefund(input: {
    bookingPaymentId: string;
    provider: BookingPaymentProviderValue;
    providerRef: string;
    reason: string;
  }): Promise<BookingPaymentRefund | null> {
    const { bookingPaymentId, provider, providerRef, reason } = input;

    let blockedByChargeback: CollectionUnderChargebackException | null = null;

    try {
      const refund = await this.txManager.run(async () => {
        const bp = await this.loadForUpdate(bookingPaymentId);
        bp.markFailed(reason);
        const failed = await this.bookingPaymentRepo.update(bp);

        // Kart itirazı kapısı (kural 17): aktif itiraz varken iade aynı parayı ikinci kez geri
        // götürür. Ret FAILED damgasını geri SARMAZ — rezervasyon gerçekten açılamadı; yalnız
        // iade satırı açılmaz ve durum alarmla insana gider (aşağıda).
        try {
          await this.chargebackExposureGuard.assertReversalWithinCollection({
            sourceType: 'BOOKING_PAYMENT',
            sourceId: failed.id.value,
            collectedAmount: failed.amountChargedBy(provider).value,
            alreadyReversedAmount: new Decimal(0),
            requestedAmount: failed.amountChargedBy(provider).value,
          });
        } catch (guardErr) {
          if (guardErr instanceof CollectionUnderChargebackException) {
            blockedByChargeback = guardErr;
            return null;
          }
          throw guardErr;
        }

        return this.refundRepo.create(
          BookingPaymentRefund.request({
            bookingPaymentId: failed.id.value,
            clinicId: failed.clinicId.value,
            organizationId: failed.organizationId.value,
            kind: 'BOOKING_FAILED',
            provider,
            chargeProviderRef: providerRef,
            amount: failed.amountChargedBy(provider),
            reason,
          })
        );
      });

      if (blockedByChargeback) {
        this.criticalFailure.publish({
          operation:
            'health-tourism.booking-payment.refund-blocked-by-chargeback',
          severity: 'CRITICAL',
          summary:
            'Rezervasyon açılamadı ama bu tahsilatın kart itirazı sürüyor/kaybedildi; iade talep edilmedi (aynı parayı ikinci kez geri götürürdü). Itiraz sonucuna göre elle karar verilmeli.',
          errorMessage: (blockedByChargeback as Error).message,
          context: { bookingPaymentId, provider, providerRef },
          clinicId: null,
          dedupeKey: `booking-refund-blocked-chargeback:${bookingPaymentId}`,
        });
      }

      return refund;
    } catch (err) {
      if (err instanceof BookingPaymentRefundAlreadyClaimedException) {
        this.logger.warn(
          `İade zaten talep edilmiş (bp=${bookingPaymentId}): ${err.message}`
        );
        return null;
      }
      throw err;
    }
  }

  /**
   * Claim-tx: kaydı kilitleyip PENDING ise PAID'e çeker. `claimed: false` dönerse
   * ödemeyi başka bir webhook (ya da bu webhook'un önceki denemesi) sahiplenmiştir.
   */
  private async claimPayment(
    command: ConfirmBookingPaymentCommand
  ): Promise<PaymentClaim> {
    const { bookingPaymentId, provider, providerRef, ctx } = command.input;

    return this.txManager.run(async () => {
      const bp = await this.loadForUpdate(bookingPaymentId);

      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check((p) => p.actorCanAccessTargetClinic(bp.clinicId.value))
        .orThrow();

      if (!bp.validate.status.isPending.value) {
        return { claimed: false, bp };
      }

      bp.markPaid(provider, providerRef);
      return { claimed: true, bp: await this.bookingPaymentRepo.update(bp) };
    });
  }

  /** Kaydı kilitli yükleyip verilen durum geçişini uygular ve yazar (finalize-tx). */
  private async mutateInTx(
    bookingPaymentId: string,
    apply: (bp: BookingPayment) => void
  ): Promise<BookingPayment> {
    return this.txManager.run(async () => {
      const bp = await this.loadForUpdate(bookingPaymentId);
      apply(bp);
      return this.bookingPaymentRepo.update(bp);
    });
  }

  private async loadForUpdate(
    bookingPaymentId: string
  ): Promise<BookingPayment> {
    const bp =
      await this.bookingPaymentRepo.findByIdForUpdate(bookingPaymentId);
    if (!bp) {
      throw new BookingPaymentNotFoundException(
        `Ödeme kaydı bulunamadı: ${bookingPaymentId}`
      );
    }
    return bp;
  }

  /**
   * Teklif ↔ fiilî maliyet sapmasını duyurur.
   *
   * Sapma **kaçınılmazdır**: satış fiyatı teklif anında dondurulur, ödeme linki
   * ise saatlerce açık kalabilir (iyzico linkinin expire API'si bile yok) ve
   * sağlayıcı rezervasyonu o anki fiyatla açar. Bu yüzden amaç sapmayı yasaklamak
   * değil, **görünür** kılmaktır: defter fiilî tutardan yazılır, fark buradan
   * duyurulur. Eşikler bilinçli olarak yok — bir kuruş fark da bir fiyat
   * uyuşmazlığının ilk belirtisi olabilir ve `dedupeKey` tekrarları susturur.
   */
  private alertOnSupplierCostDrift(bp: BookingPayment): void {
    const cost = bp.supplierCost;
    if (cost.drift === 'NONE') return;

    const context = {
      bookingPaymentId: bp.id.value,
      bookingType: bp.bookingType,
      quotedAmount: bp.netAmount.toApiFormat(),
      quotedCurrency: bp.netAmount.currency,
      supplierAmount: bp.supplierAmount?.toApiFormat() ?? null,
      supplierCurrency: bp.supplierAmount?.currency ?? null,
      saleAmount: bp.saleAmount.toApiFormat(),
      postedSupplierAmount: cost.ledgerAmount.toApiFormat(),
    };

    // Maliyetin altında satış: komisyon negatif olurdu. Fiş yazılamaz (posting
    // kuralı dengesiz/negatif hasılat satırını reddeder) ve zararın hangi hesaba
    // alınacağı bir muhasebe kararıdır — kural 11: otomatik onarım yok.
    if (cost.exceedsSale) {
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.supplier-cost',
        severity: 'CRITICAL',
        summary:
          'Rezervasyon maliyetin ALTINDA satıldı: sağlayıcının ücretlendirdiği tutar satış fiyatını aşıyor.',
        errorMessage: null,
        context,
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-cost-above-sale:${bp.id.value}`,
      });
      return;
    }

    // Fiilî maliyet bilinmiyor ya da karşılaştırılamıyor → defter teklif
    // tutarından yazıldı. Tedarikçi faturası geldiğinde fark 320'de kalır.
    if (cost.drift === 'UNKNOWN' || cost.drift === 'CURRENCY_MISMATCH') {
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.supplier-cost',
        severity: 'CRITICAL',
        summary:
          cost.drift === 'UNKNOWN'
            ? 'Sağlayıcı maliyeti bildirmedi; defter teklif tutarından yazıldı.'
            : 'Sağlayıcı maliyeti farklı para biriminde; defter teklif tutarından yazıldı.',
        errorMessage: null,
        context,
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-cost-unresolved:${bp.id.value}`,
      });
      return;
    }

    this.criticalFailure.publish({
      operation: 'health-tourism.booking-payment.supplier-cost',
      severity: 'WARNING',
      summary:
        'Sağlayıcının ücretlendirdiği maliyet teklif edilenden farklı; komisyon beklenenden sapıyor.',
      errorMessage: null,
      context,
      clinicId: bp.clinicId.value,
      dedupeKey: `booking-cost-drift:${bp.id.value}`,
    });
  }

  /**
   * Müşteriye rezervasyon onayını mesajlaşma kanalından bildirir.
   *
   * Messaging ayrı bir servis olduğu için bu artık bir **komut değil olaydır**: core
   * "şu yazışmaya onay mesajı gönder" diye emretmez, "rezervasyon onaylandı" diye
   * duyurur; kanaldan nasıl bildirileceği messaging'in kararıdır.
   *
   * `emit` bilerek beklenmiyor (fire-and-forget): bildirim ödemeyi bloklamamalı.
   * Konuşma bağlamı yoksa (conversationId null) atlanır.
   */
  private notifyCustomer(bp: BookingPayment): void {
    if (!bp.conversationId) return;

    const payload: BookingConfirmedEventPayload = {
      clinicId: bp.clinicId.value,
      conversationId: bp.conversationId,
      bookingType: bp.bookingType,
      referenceCode: bp.bookingReference ?? bp.bookingId ?? bp.id.value,
      summary: this.buildSummary(bp),
    };

    this.natsClient.emit(NATS_SUBJECTS.booking.confirmed, payload).subscribe({
      error: (err: unknown) =>
        this.logger.warn(
          `Onay bildirimi yayınlanamadı (bp=${bp.id.value}): ${
            err instanceof Error ? err.message : String(err)
          }`
        ),
    });
  }

  private buildSummary(bp: BookingPayment): string {
    const intent = bp.bookingIntent;

    switch (intent.type) {
      case BookingPaymentTypeSchema.enum.HOTEL:
        return `${intent.hotelName} (${intent.checkIn} → ${intent.checkOut})`;
      case BookingPaymentTypeSchema.enum.TRANSFER:
        return `${intent.vehicleName} transferi`;
      case BookingPaymentTypeSchema.enum.FLIGHT:
        return intent.summary;
      default:
        return assertNever(
          intent,
          'Özeti üretilemeyen rezervasyon niyeti türü.'
        );
    }
  }

  /**
   * intent'e göre ilgili book command'ini dispatch eder; dönen dahili rezervasyon
   * id'sini verir.
   *
   * **`switch` + `assertNever` bilinçli**: burası daha önce `if (HOTEL) … else …`
   * idi ve birleşime yeni bir tür eklendiğinde o tür sessizce transfer dalına
   * düşüyordu (TypeScript `else`'i kalan üyelere daraltıyor, `as` cast'i de şekil
   * uyuşmazlığını yutuyordu). Artık kapsanmayan her yeni tür DERLEME hatasıdır.
   */
  private async book(bp: BookingPayment): Promise<BookedSupplierResult> {
    const ctx = this.buildSystemContext(bp);
    const intent = bp.bookingIntent;

    switch (intent.type) {
      case BookingPaymentTypeSchema.enum.HOTEL:
        return this.commandBus.execute(
          new BookHotelCommand(this.toHotelDto(intent, bp), ctx)
        );

      case BookingPaymentTypeSchema.enum.TRANSFER:
        return this.commandBus.execute(
          new BookTransferCommand(this.toTransferDto(intent, bp), ctx)
        );

      case BookingPaymentTypeSchema.enum.FLIGHT:
        // Hibrit akış: koltuk zaten tutulduysa yapılacak iş yalnız ödemedir;
        // aksi halde sipariş ödemeyle birlikte şimdi açılır.
        return intent.mode === 'HOLD'
          ? this.commandBus.execute(
              new PayHeldFlightCommand({
                bookingId: intent.flightBookingId,
                ctx,
              })
            )
          : this.commandBus.execute(
              new BookFlightCommand(this.toFlightDto(intent, bp), ctx)
            );

      default:
        return assertNever(
          intent,
          'Rezervasyona çevrilemeyen ödeme niyeti türü.'
        );
    }
  }

  private toFlightDto(
    intent: FlightInstantBookingIntent,
    bp: BookingPayment
  ): BookFlightDto {
    return {
      optionId: intent.optionId,
      passengers: intent.passengers,
      contactEmail: intent.contactEmail,
      contactPhone: intent.contactPhone,
      clinicId: bp.clinicId.value,
      patientId: bp.patientId?.value ?? undefined,
      leadId: bp.leadId?.value ?? undefined,
    } as BookFlightDto;
  }

  private toHotelDto(
    intent: HotelBookingIntent,
    bp: BookingPayment
  ): BookHotelDto {
    return {
      hotelCode: intent.hotelCode,
      checkIn: DateTimeManager.create(intent.checkIn),
      checkOut: DateTimeManager.create(intent.checkOut),
      holderName: intent.holderName,
      holderSurname: intent.holderSurname,
      rooms: intent.rooms,
      remarks: intent.remarks,
      patientId: bp.patientId?.value ?? undefined,
      leadId: bp.leadId?.value ?? undefined,
    } as BookHotelDto;
  }

  private toTransferDto(
    intent: TransferBookingIntent,
    bp: BookingPayment
  ): BookTransferDto {
    return {
      language: intent.language,
      holderName: intent.holderName,
      holderSurname: intent.holderSurname,
      holderEmail: intent.holderEmail,
      holderPhone: intent.holderPhone,
      transfers: intent.transfers,
      patientId: bp.patientId?.value ?? undefined,
      leadId: bp.leadId?.value ?? undefined,
      clinicId: bp.clinicId.value,
    } as BookTransferDto;
  }

  /** Ödenen sağlayıcının dışındaki linki geçersiz kılar (Stripe expire; iyzico no-op). */
  private async expireOtherLink(
    paidProvider: BookingPaymentProviderValue,
    bp: BookingPayment
  ): Promise<void> {
    try {
      const result =
        paidProvider === PaymentProviders.IYZICO && bp.stripeSessionId
          ? await this.stripeLink.expireLink(bp.stripeSessionId)
          : paidProvider === PaymentProviders.STRIPE && bp.iyzicoConversationId
            ? await this.iyzicoLink.expireLink(bp.iyzicoConversationId)
            : null;

      // iyzico CheckoutForm'un expire API'si yok: link canlı kalır ve sonradan ödenebilir.
      // Ödenirse çift çekim akışı (336 + iade) devreye girer; yine de sessiz kalmayız.
      if (result === 'NOT_SUPPORTED') {
        this.criticalFailure.publish({
          operation: 'health-tourism.booking-payment.expire-link',
          severity: 'WARNING',
          summary:
            'Ödenmeyen ikinci ödeme linki sağlayıcıda kapatılamaz (expire desteklenmiyor); sonradan ödenirse çift çekim olarak iade edilir.',
          errorMessage: null,
          context: { bookingPaymentId: bp.id.value, paidProvider },
          clinicId: bp.clinicId.value,
          dedupeKey: `booking-expire-link-unsupported:${bp.id.value}`,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Diğer link expire edilemedi (bp=${bp.id.value}): ${
          err instanceof Error ? err.message : err
        }`
      );
      // İkinci ödeme linki açık kaldı: müşteri onu da öderse ikinci bir tahsilat
      // doğar. Kayıt tarafı kilitli sahiplenmeyle ikinci rezervasyonu engelliyor
      // ama PARA çekilmiş olur — linkin elle kapatılması gerekir.
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.expire-link',
        severity: 'WARNING',
        summary:
          'Ödenmeyen ikinci ödeme linki kapatılamadı; çift tahsilat riski açık.',
        errorMessage: err instanceof Error ? err.message : String(err),
        context: { bookingPaymentId: bp.id.value, paidProvider },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-expire-link-failed:${bp.id.value}`,
      });
    }
  }

  /**
   * Sahiplenilemeyen bir ödeme bildirimi geldi: ya **aynı ödemenin tekrarı** ya da
   * **ikinci bir çekim**. Ayırt edici ödeme referansıdır — yerel durum değil.
   *
   * Önceki kod kararı `isSettled` (PAID|BOOKED) üzerinden veriyordu ve iki yönde
   * de hatalıydı:
   *
   * 1. **Webhook tekrarı meşru ödemeyi iade ettiriyordu.** Stripe teslimatı
   *    at-least-once'tır ve iyzico callback'i kullanıcı sayfayı yenilediğinde
   *    tekrar çalışır; ikisi de AYNI `providerRef` ile gelir. Kayıt PAID/BOOKED
   *    olduğu için `isSettled` tutuyor ve o referans iade ediliyordu: hizmet
   *    verilmiş, para geri ödenmiş, kayıt hâlâ BOOKED.
   * 2. **Terminal ama "settled" olmayan durumda gelen ödeme sessizce
   *    tutuluyordu.** FAILED/REFUNDED/EXPIRED kayıtta `isSettled` false → ne iade
   *    ne alarm. Bu ulaşılabilir: iyzico'nun expire API'si yok (`expireLink`
   *    no-op), yani Stripe ödenip book başarısız olup iade edildikten sonra bile
   *    iyzico linki **canlı** kalıyor ve sonradan ödenebiliyor.
   *
   * Doğru kural: sahiplenemediğimiz bir çekim BİZİM olmamalı. Aynı referanssa
   * hiçbir şey yapılmaz (idempotent); farklı referanssa karşılığı verilemez →
   * yerel durum ne olursa olsun iade edilir ve iz bırakılır.
   */
  private async handleUnclaimedPayment(input: {
    bp: BookingPayment;
    provider: BookingPaymentProviderValue;
    providerRef: string;
  }): Promise<void> {
    const { bp, provider, providerRef } = input;
    const bookingPaymentId = bp.id.value;

    // (a) Aynı ödemenin yeniden bildirimi → idempotent yok-sayma.
    if (bp.paidProviderRef === providerRef) {
      this.logger.log(
        `Ödeme bildirimi yinelenmiş, yok sayıldı (bp=${bookingPaymentId}, ref=${providerRef}).`
      );
      return;
    }

    // (b) Farklı bir çekim: bu paranın karşılığı verilemez.
    //
    // SAHİPLENME olay defterinin dedupe'u değil iade SATIRININ unique'idir: dedupe mevcut
    // kimliği sessizce döner ("zaten vardı" bilgisini vermez) ve okuma-sonra-yazma kilitsizdir.
    // Aynı çekimin webhook'u tekrar gelirse satır zaten var → ikinci iade çağrısı YAPILMAZ.
    const refund = await this.claimUnclaimedChargeRefund({
      bookingPaymentId,
      provider,
      providerRef,
    });
    if (!refund) {
      this.logger.log(
        `İkinci tahsilatın iadesi zaten talep edilmiş, yok sayıldı (bp=${bookingPaymentId}, ref=${providerRef}).`
      );
      return;
    }

    this.logger.warn(
      `İkinci tahsilat tespit edildi (bp=${bookingPaymentId}, provider=${provider}, durum=${bp.status}). İade ediliyor.`
    );

    // Executor 336 açılışını (B 108 / A 336) iade çağrısından önce yazar ve fırlatmaz; REJECTED /
    // UNCONFIRMED CRITICAL'ı kendisi basar. Burada yalnız başarının izini bırakırız.
    const execution = await this.refundExecutor.execute(refund);

    if (execution.status === 'CONFIRMED') {
      // Başarılı iade de iz bırakır: çift çekim akışta bir sorunun belirtisidir
      // (ör. ödenmiş kaydın diğer linki hâlâ canlı).
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.second-charge',
        severity: 'WARNING',
        summary: 'İkinci bir tahsilat alındı ve iade edildi.',
        errorMessage: null,
        context: {
          bookingPaymentId,
          provider,
          providerRef,
          status: bp.status,
          refundId: refund.id.value,
        },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-second-charge:${providerRef}`,
      });
    }
  }

  /**
   * İkinci çekim için PENDING iade satırını açar. Satır zaten varsa (tekrar teslim) `null`.
   * Kilit sırası: önce `booking_payments`, sonra iade satırı.
   */
  private async claimUnclaimedChargeRefund(input: {
    bookingPaymentId: string;
    provider: BookingPaymentProviderValue;
    providerRef: string;
  }): Promise<BookingPaymentRefund | null> {
    const { bookingPaymentId, provider, providerRef } = input;

    try {
      return await this.txManager.run(async () => {
        const bp = await this.loadForUpdate(bookingPaymentId);

        const existing = await this.refundRepo.findByCharge({
          provider,
          chargeProviderRef: providerRef,
        });
        if (existing) return null;

        return this.refundRepo.create(
          BookingPaymentRefund.request({
            bookingPaymentId: bp.id.value,
            clinicId: bp.clinicId.value,
            organizationId: bp.organizationId.value,
            kind: 'UNCLAIMED_CHARGE',
            provider,
            chargeProviderRef: providerRef,
            // `provider` **iade edilen** kanaldır (sahiplenilmiş kanal değil): hangi kanalın ne
            // cinsten çektiği entity'de tek yerde durur.
            amount: bp.amountChargedBy(provider),
            reason: 'Aynı rezervasyon için ikinci tahsilat (çift çekim).',
          })
        );
      });
    } catch (err) {
      if (err instanceof BookingPaymentRefundAlreadyClaimedException)
        return null;
      throw err;
    }
  }

  /** Webhook'ta actor yok → klinik-kapsamlı sistem context'i kurar (bus dispatch için). */
  private buildSystemContext(bp: BookingPayment): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId: bp.clinicId.value,
      organizationId: bp.organizationId.value,
      managedClinics: [{ id: bp.clinicId.value }],
    };
    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'BOOKING_PAYMENT_WEBHOOK',
    };
  }
}
