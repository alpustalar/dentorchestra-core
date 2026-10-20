import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { Inject, Logger } from '@nestjs/common';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import BookingPaymentStatusSchema from '@input-type-schemas/BookingPaymentStatusSchema';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPaymentRefundExecutor } from '@modules/crm/health-tourism/booking-payment/application/services/booking-payment-refund.executor';
import {
  CARD_CHARGEBACK_EXPOSURE_GUARD,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { RefundBookingPaymentCommand } from './refund-booking-payment.command';
import { RefundBookingPaymentResponse } from './refund-booking-payment.response';

interface ClaimForRefundProps {
  readonly bookingId: string;
  readonly retained: SupplierRetainedCost | null;
  readonly reason?: string;
}

@CommandHandler(RefundBookingPaymentCommand)
export class RefundBookingPaymentHandler implements ICommandHandler<
  RefundBookingPaymentCommand,
  RefundBookingPaymentResponse
> {
  private readonly logger = new Logger(RefundBookingPaymentHandler.name);

  constructor(
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    @Inject(CARD_CHARGEBACK_EXPOSURE_GUARD)
    private readonly chargebackExposureGuard: ICardChargebackExposureGuard,
    private readonly refundExecutor: BookingPaymentRefundExecutor,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * Önce **kilitli claim** (BOOKED→REFUNDED + PENDING iade satırı, tek tx), sonra sağlayıcı
   * çağrısı (executor, tx dışı), sonra sonucun kilitli yazılması.
   *
   * Sıra bilinçli: iki eşzamanlı iptal isteği kilitsiz okusaydı ikisi de "BOOKED" görüp
   * sağlayıcıya iki kez iade gönderirdi — para iki kez çıkar. Claim önce yazıldığı için ikinci
   * istek REFUNDED görüp atlar; ayrıca `(provider, charge_provider_ref)` unique'i son çaredir.
   *
   * `booking_payments.status = REFUNDED` iadenin TALEP edildiğini söyler; paranın dönüp
   * dönmediği `BookingPaymentRefund.status`'tadır. Sağlayıcı iadeyi reddederse ya da sonuç
   * bilinmezse satır FAILED / UNCONFIRMED olur ve ters fiş YAZILMAZ — para hâlâ bizdedir.
   */
  async execute(
    command: RefundBookingPaymentCommand
  ): Promise<RefundBookingPaymentResponse> {
    const { bookingId, reason, retained } = command.payload;

    const refund = await this.claimForRefund({ bookingId, reason, retained });
    if (!refund) return { refundId: null, status: 'SKIPPED' };

    const execution = await this.refundExecutor.execute(refund);

    this.logger.log(
      `İade yürütüldü (refund=${execution.refundId}, durum=${execution.status}).`
    );
    return { refundId: execution.refundId, status: execution.status };
  }

  /**
   * Kaydı kilitleyip iadeyi sahiplenir. İade edilebilir durumda değilse (kayıt yok, BOOKED
   * değil, ödeme referansı yok) `null` döner ve akış sessizce atlanır.
   */
  private async claimForRefund(
    props: ClaimForRefundProps
  ): Promise<BookingPaymentRefund | null> {
    const { bookingId, reason, retained } = props;

    try {
      return await this.txManager.run(async () => {
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

        // Kart itirazı kapısı (kural 17): bp satırı yukarıda kilitli, yani aynı satırı kilitleyen
        // itiraz açılışıyla sıraya girer. Aktif (açık/kaybedilmiş) itiraz varken iade aynı parayı
        // ikinci kez geri götürür (bir kez sağlayıcı kesintisi, bir kez bizim iademiz). Hata
        // claim'i geri sarar: bp BOOKED kalır, iade satırı açılmaz.
        // Tahsilat başına tek iade satırı olduğundan (unique) daha önce geri götürülen tutar 0'dır.
        await this.chargebackExposureGuard.assertReversalWithinCollection({
          sourceType: 'BOOKING_PAYMENT',
          sourceId: bp.id.value,
          collectedAmount: bp.receivedAmount.value,
          alreadyReversedAmount: new Decimal(0),
          requestedAmount: bp.receivedAmount.value,
        });

        // İptal ekonomisi iade damgasıyla **aynı transaction'da** yazılır: ayırmak, araya düşen
        // bir çökmede "iade edildi ama cezası bilinmiyor" satırı bırakır ve ceza bir daha
        // sorulamaz (iptal çağrısı idempotent değil).
        const resolvedReason = reason ?? 'Rezervasyon iptal edildi.';
        bp.markRefunded({ reason: resolvedReason, retained });
        await this.bookingPaymentRepo.update(bp);

        // v1: tam satış tutarı iade (HotelBeds iptal cezası mahsubu sonraki iterasyon).
        // Tahsil edilen tutar/para birimi entity'de tek yerde: iyzico TRY çekmişti, Stripe
        // satış cinsinden. Defter köprüsü de aynı kaynağı okur.
        return this.refundRepo.create(
          BookingPaymentRefund.request({
            bookingPaymentId: bp.id.value,
            clinicId: bp.clinicId.value,
            organizationId: bp.organizationId.value,
            kind: 'CANCELLATION',
            provider,
            chargeProviderRef: providerRef,
            amount: bp.receivedAmount,
            reason: resolvedReason,
          })
        );
      });
    } catch (err) {
      // Aynı tahsilat için iade zaten talep edilmiş (eşzamanlı istek): tekrar teslim.
      if (err instanceof BookingPaymentRefundAlreadyClaimedException) {
        this.logger.warn(
          `İade atlandı (bookingId=${bookingId}): ${err.message}`
        );
        return null;
      }
      throw err;
    }
  }
}
