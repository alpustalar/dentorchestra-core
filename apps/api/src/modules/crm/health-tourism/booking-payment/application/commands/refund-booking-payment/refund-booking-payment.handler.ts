import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  IPaymentLinkProvider,
  IYZICO_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK,
} from '@src/infrastructure/payment/links/payment-link.port';
import { RefundBookingPaymentCommand } from './refund-booking-payment.command';
import { PaymentProviders } from '@common/constants';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import BookingPaymentStatusSchema from '@input-type-schemas/BookingPaymentStatusSchema';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  BookingPaymentProviderValue,
  SupplierRetainedCost,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPlatformLedgerService } from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

interface ClaimForRefundProps {
  readonly bookingId: string;
  readonly retained: SupplierRetainedCost | null;
  readonly reason?: string;
}

/** Kilitli claim'in çıktısı: iade için gereken, artık null olmadığı kesin alanlar. */
interface RefundClaim {
  readonly bp: BookingPayment;
  readonly provider: BookingPaymentProviderValue;
  readonly providerRef: string;
}

@CommandHandler(RefundBookingPaymentCommand)
export class RefundBookingPaymentHandler implements ICommandHandler<
  RefundBookingPaymentCommand,
  void
> {
  private readonly logger = new Logger(RefundBookingPaymentHandler.name);

  constructor(
    @Inject(IYZICO_PAYMENT_LINK)
    private readonly iyzicoLink: IPaymentLinkProvider,
    @Inject(STRIPE_PAYMENT_LINK)
    private readonly stripeLink: IPaymentLinkProvider,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    private readonly platformLedger: BookingPlatformLedgerService,
    private readonly criticalFailure: CriticalFailurePublisher,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * Önce **kilitli claim** (BOOKED→REFUNDED), sonra sağlayıcıya iade çağrısı.
   *
   * Sıra bilinçli: iki eşzamanlı iptal isteği kilitsiz okusaydı ikisi de "BOOKED"
   * görüp sağlayıcıya iki kez iade gönderirdi — para iki kez çıkar. Claim önce
   * yazıldığı için ikinci istek REFUNDED görüp atlar. Ters risk (durum REFUNDED
   * ama sağlayıcı çağrısı düştü) para kaybettirmez, loglanıp elle tamamlanır.
   */
  async execute(command: RefundBookingPaymentCommand): Promise<void> {
    const { bookingId, reason, retained } = command.payload;

    const claim = await this.claimForRefund({ bookingId, reason, retained });
    if (!claim) return;

    const { bp, provider, providerRef } = claim;

    // v1: tam satış tutarı iade (HotelBeds iptal cezası mahsubu sonraki iterasyon).
    const adapter =
      provider === PaymentProviders.IYZICO ? this.iyzicoLink : this.stripeLink;
    // Tahsil edilen tutar/para birimi entity'de tek yerde: iyzico TRY çekmişti,
    // Stripe satış cinsinden. Defter köprüsü de aynı kaynağı okur — iki yerde
    // ayrı ayrı türetmek, birinin değişip diğerinin kalmasına açıktı.
    const charged = bp.receivedAmount;
    const amount = charged.value.toNumber();
    const currency = charged.currency;

    try {
      await adapter.refund({ providerRef, amount, currency, reason });
    } catch (err) {
      // Kayıt REFUNDED olarak mühürlendi ama para geri gitmedi → elle tamamlanmalı.
      // Durumu geri almıyoruz: geri alsak yeniden deneme mükerrer iade riskine açılır
      // (çağrı zaman aşımına uğradıysa sağlayıcıda başarılı olmuş olabilir).
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `İade çağrısı başarısız (bp=${bp.id.value}, provider=${provider}); kayıt REFUNDED, manuel müdahale gerekli: ${message}`
      );
      // Ters kayıt **yazılmaz**: defter paranın gerçekliğini gösterir ve bu
      // çağrıdan sonra paranın geri gidip gitmediği bilinmiyor (zaman aşımı
      // sağlayıcıda başarı olabilir). Fiş atmak "iade edildi" diye yanlış
      // beyan olurdu; atmamak 108/601/320'yi eski hâlinde bırakır. İkisi de
      // yanlış, ama ikincisi **bilinen** bir eksiklik → alarmla insana gider.
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.refund',
        severity: 'CRITICAL',
        summary:
          'Rezervasyon iadesi sağlayıcıda sonuçlanmadı: kayıt REFUNDED ama paranın geri gittiği doğrulanamadı; platform defterinin ters kaydı da yazılmadı.',
        errorMessage: message,
        context: {
          bookingPaymentId: bp.id.value,
          provider,
          providerRef,
          amount: String(amount),
          currency,
        },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-refund-unconfirmed:${bp.id.value}`,
      });
      throw err;
    }

    this.logger.log(
      `İade tamamlandı (bp=${bp.id.value}, provider=${provider}, amount=${amount} ${currency}).`
    );

    // Para fiilen geri gitti → platform defterinin ters kaydı. Best-effort:
    // hatası iadeyi geri almaz (geri alınamaz), CRITICAL ile duyurulur.
    await this.platformLedger.recordBestEffort({
      kind: 'REFUNDED',
      bp,
      provider,
    });

    // Ceza bilinmiyorsa defter cezasız ters kayıt yazdı: 320'de sağlayıcının
    // yine faturalayacağı tutar kadar eksik düşüm kalır. Eşik yok — bir kuruş
    // fark da sağlayıcı mutabakatında açık demektir.
    this.alertOnUnknownRetainedCost(bp);
  }

  /**
   * Sağlayıcının alıkoyduğu cezanın öğrenilemediği hâlleri duyurur.
   *
   * Neden yasaklamak yerine duyurmak: cezayı bilmeden ters kayıt yazmamak
   * 108'i (giden para), 601'i (kazanılmamış komisyon) ve 320'yi (artık olmayan
   * borç) birlikte yanlış bırakırdı. Cezasız varsayım yalnız 320'yi eksik
   * bırakır — üç hesap yerine bir hesap. Varsayımın bedeli bu alarmla görünür.
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
   * Kaydı kilitleyip iadeyi sahiplenir. İade edilebilir durumda değilse (kayıt yok,
   * BOOKED değil, ödeme referansı yok) `null` döner ve akış sessizce atlanır.
   */
  private async claimForRefund(
    props: ClaimForRefundProps
  ): Promise<RefundClaim | null> {
    const { bookingId, reason, retained } = props;
    return this.txManager.run(async () => {
      const bp =
        await this.bookingPaymentRepo.findByBookingIdForUpdate(bookingId);

      // B7 öncesi/ödemesiz rezervasyonda kayıt olmayabilir → iptal akışını bozmadan geç.
      if (!bp) {
        this.logger.warn(
          `İade için ödeme kaydı bulunamadı (bookingId=${bookingId}); atlandı.`
        );
        return null;
      }

      if (bp.status !== BookingPaymentStatusSchema.enum.BOOKED) {
        this.logger.warn(
          `İade atlandı (bp=${bp.id.value}); durum BOOKED değil (mevcut: ${bp.status}).`
        );
        return null;
      }

      const provider = bp.paidProvider;
      const providerRef = bp.paidProviderRef;
      if (!provider || !providerRef) {
        this.logger.warn(
          `İade atlandı (bp=${bp.id.value}); ödeme referansı yok.`
        );
        return null;
      }

      // İptal ekonomisi iade damgasıyla **aynı transaction'da** yazılır: ayırmak,
      // araya düşen bir çökmede "iade edildi ama cezası bilinmiyor" satırı
      // bırakır ve ceza bir daha sorulamaz (iptal çağrısı idempotent değil).
      bp.markRefunded({
        reason: reason ?? 'Rezervasyon iptal edildi.',
        retained,
      });
      return {
        bp: await this.bookingPaymentRepo.update(bp),
        provider,
        providerRef,
      };
    });
  }
}
