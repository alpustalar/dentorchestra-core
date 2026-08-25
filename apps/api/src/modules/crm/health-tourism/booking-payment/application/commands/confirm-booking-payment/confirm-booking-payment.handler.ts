import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { ActorContext } from '@common/interfaces';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import {
  IPaymentLinkProvider,
  IYZICO_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK,
} from '@src/infrastructure/payment/links/payment-link.port';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  BookingPaymentProviderValue,
  FlightInstantBookingIntent,
  HotelBookingIntent,
  TransferBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPaymentNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
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
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { BookingPaymentTypeSchema, FinancialEventTypeSchema } from '@shared';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { PlatformBookingSettledEventPayload } from '@modules/finance/accounting/posting/domain/posting/event-payloads';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

/** Kilitli claim adımının sonucu: ödeme bu webhook tarafından mı sahiplenildi? */
type PaymentClaim =
  | { readonly claimed: true; readonly bp: BookingPayment }
  | { readonly claimed: false; readonly bp: BookingPayment };

@CommandHandler(ConfirmBookingPaymentCommand)
export class ConfirmBookingPaymentHandler
  implements ICommandHandler<ConfirmBookingPaymentCommand, void>
{
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
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
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

    // Idempotency: bu webhook ödemeyi sahiplenemedi. Zaten ödenmiş bir kayda ikinci
    // ödeme gelmişse (iki link de ödendi) → çift-çekim → ikinci ödemeyi iade et.
    if (!claim.claimed) {
      if (claim.bp.validate.status.isSettled.value) {
        this.logger.warn(
          `Çift ödeme tespit edildi (bp=${bookingPaymentId}, provider=${provider}). İkinci ödeme iade ediliyor.`
        );
        await this.refundCharge(provider, providerRef, claim.bp);
      }
      return;
    }

    const paid = claim.bp;

    // Diğer linki geçersiz kıl (best-effort).
    await this.expireOtherLink(provider, paid);

    // intent'i HotelBeds'e replay et.
    try {
      const bookingId = await this.book(paid);
      const booked = await this.mutateInTx(bookingPaymentId, (bp) =>
        bp.markBooked(bookingId, bookingId)
      );
      this.logger.log(
        `Rezervasyon tamamlandı (bp=${bookingPaymentId}, bookingId=${bookingId}).`
      );
      // Tahsilat kliniğin defterine YAZILMAZ; platform defterine yazılır. Otel/transfer
      // bir platform işlemidir (hasta platforma öder, platform HotelBeds'e öder) ve
      // komisyon platform geliridir — klinik bu işleme finansal olarak taraf değildir.
      await this.postSettlementToPlatformLedger(booked, provider);
      // Müşteriye mesajlaşma kanalından onay (AI dilinde / pencere dışı HSM); hatası bozmaz.
      this.notifyCustomer(booked);
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Rezervasyon başarısız';
      this.logger.error(
        `HotelBeds rezervasyonu başarısız (bp=${bookingPaymentId}): ${reason}`
      );
      const failed = await this.mutateInTx(bookingPaymentId, (bp) =>
        bp.markFailed(reason)
      );
      // Tahsil edildi ama rezervasyon açılamadı → ödemeyi iade et (kilit dışında).
      try {
        await this.refundCharge(provider, providerRef, failed);
        await this.mutateInTx(bookingPaymentId, (bp) =>
          bp.markRefunded(reason)
        );
      } catch (refundErr) {
        this.logger.error(
          `İade de başarısız (bp=${bookingPaymentId}); manuel müdahale gerekli: ${
            refundErr instanceof Error ? refundErr.message : refundErr
          }`
        );
        // Akışın EN KÖTÜ hali: para tahsil edildi, rezervasyon açılamadı ve iade
        // de geçmedi. Müşterinin parası bizde, karşılığında hiçbir şey yok ve
        // otomatik telafi yolu kalmadı — elle iade şart.
        this.criticalFailure.publish({
          operation: 'health-tourism.booking-payment.refund',
          severity: 'CRITICAL',
          summary:
            'Tahsilat alındı, rezervasyon açılamadı ve iade de başarısız — elle iade gerekiyor.',
          errorMessage:
            refundErr instanceof Error ? refundErr.message : String(refundErr),
          context: {
            bookingPaymentId,
            provider,
            providerRef,
            bookingFailureReason: reason,
          },
          clinicId: failed.clinicId.value,
          dedupeKey: `booking-refund-failed:${bookingPaymentId}`,
        });
      }
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
   * Tahsilatı **platform** defterine yazar (komisyon geliri + tedarikçi borcu).
   *
   * Bilerek best-effort: buraya gelindiğinde para tahsil edilmiş ve rezervasyon
   * açılmıştır. Muhasebe kaydı atılamadı diye hata fırlatmak, üstteki catch'i
   * tetikleyip başarılı bir rezervasyonu iade akışına sokardı — kaydı sonradan
   * tamamlamak, müşterinin rezervasyonunu iptal etmekten çok daha ucuz.
   * `dedupeKey` sayesinde olay yeniden denendiğinde mükerrer yazılmaz.
   */
  private async postSettlementToPlatformLedger(
    bp: BookingPayment,
    provider: BookingPaymentProviderValue
  ): Promise<void> {
    try {
      const target = await this.platformTenant.resolve();

      const sale = bp.saleAmount.value;
      const supplier = bp.netAmount.value;
      // `satisfies`: sözleşmeye uygunluk derleyicide doğrulanır ama literal tipi
      // korunur — `Record<string, unknown>`'a genişletmek olayın JSON payload
      // tipiyle (InputJsonValue) uyuşmuyor.
      const payload = {
        saleAmount: sale.toFixed(2),
        supplierAmount: supplier.toFixed(2),
        commission: sale.minus(supplier).toFixed(2),
        currency: bp.saleCurrency.value,
        bookingType: bp.bookingType,
        provider,
      } satisfies PlatformBookingSettledEventPayload;

      await this.commandBus.execute(
        new RecordFinancialEventCommand(
          {
            clinicId: target.clinicId,
            type: FinancialEventTypeSchema.enum.PLATFORM_BOOKING_SETTLED,
            payload,
            sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BOOKING_PAYMENT,
            sourceRefId: bp.id.value,
            dedupeKey: FinancialEventDedupeKeys.platform_booking_settled(
              bp.id.value
            ),
          },
          this.buildPlatformContext(target.clinicId, target.organizationId)
        )
      );
    } catch (err) {
      this.logger.error(
        `Platform defterine tahsilat yazılamadı (bp=${bp.id.value}); rezervasyon etkilenmedi, kayıt sonradan tamamlanmalı: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      // Rezervasyon açıldı ve para alındı ama platform defterine hiç düşmedi:
      // komisyon geliri ve tedarikçi borcu kayıt dışı kalır.
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.platform-ledger',
        severity: 'CRITICAL',
        summary:
          'Rezervasyon tahsilatı platform defterine yazılamadı (komisyon/tedarikçi kaydı eksik).',
        errorMessage: err instanceof Error ? err.message : String(err),
        context: { bookingPaymentId: bp.id.value },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-platform-ledger-failed:${bp.id.value}`,
      });
    }
  }

  /** Platform defterine yazarken kullanılacak sistem context'i. */
  private buildPlatformContext(
    clinicId: string,
    organizationId: string
  ): IGetContext {
    const actor: ActorContext = {
      ...SYSTEM_ACTOR,
      clinicId,
      organizationId,
      managedClinics: [{ id: clinicId }],
    };
    return {
      actor,
      source: ExecutionSources.INTERNAL_CASCADE,
      ip: '127.0.0.1',
      userAgent: 'BOOKING_PAYMENT_WEBHOOK',
    };
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
  private async book(bp: BookingPayment): Promise<string> {
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
      if (paidProvider === PaymentProviders.IYZICO && bp.stripeSessionId) {
        await this.stripeLink.expireLink(bp.stripeSessionId);
      } else if (
        paidProvider === PaymentProviders.STRIPE &&
        bp.iyzicoConversationId
      ) {
        await this.iyzicoLink.expireLink(bp.iyzicoConversationId);
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

  /** Belirtilen sağlayıcı ödemesini iade eder (durum değiştirmez — çağıran karar verir). */
  private async refundCharge(
    provider: BookingPaymentProviderValue,
    providerRef: string,
    bp: BookingPayment
  ): Promise<void> {
    const adapter =
      provider === PaymentProviders.IYZICO ? this.iyzicoLink : this.stripeLink;
    const amount =
      provider === PaymentProviders.IYZICO
        ? bp.tryAmount.value.toNumber()
        : bp.saleAmount.value.toNumber();
    const currency =
      provider === PaymentProviders.IYZICO
        ? Currency.fromTrusted(CurrencySchema.enum.TRY).value
        : bp.saleCurrency.value;
    await adapter.refund({ providerRef, amount, currency });
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
