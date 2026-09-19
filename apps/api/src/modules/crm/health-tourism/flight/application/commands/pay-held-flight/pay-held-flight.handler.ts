import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { PayHeldFlightCommand } from './pay-held-flight.command';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
  IDuffelFlightBookingCommandRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import {
  FlightBookingNotFoundException,
  FlightHoldExpiredException,
  FlightPaymentInProgressException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';

/**
 * Ödemeyi sahiplenme sonucu.
 * - `ALREADY_CONFIRMED`: mükerrer çağrı; hiçbir şey yapılmaz.
 * - `FRESH`: HELD kayıt bu istek tarafından sahiplenildi; ödeme gönderilecek.
 * - `RECLAIMED`: önceki deneme sonucu yazamadan öldü; ödemeden ÖNCE sağlayıcıya
 *   sorulur (para geçmiş olabilir).
 */
type PaymentClaim =
  | { kind: 'ALREADY_CONFIRMED' }
  | { kind: 'FRESH' | 'RECLAIMED'; duffelOrderId: string; amount: string; currency: string };

@CommandHandler(PayHeldFlightCommand)
export class PayHeldFlightHandler
  implements ICommandHandler<PayHeldFlightCommand, string>
{
  private readonly logger = new Logger(PayHeldFlightHandler.name);

  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService,
    @Inject(DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * Tutulan koltuğu öder. Akış üç ayrı adımdır çünkü Duffel çağrısı bilerek satır
   * kilidinin DIŞINDA yapılır (saniyeler süren bir dış istek satırı kilitli tutarsa
   * eşzamanlı iptal/okuma bekler):
   *
   *   1. Kilit altında SAHİPLEN — HELD → PAYMENT_IN_PROGRESS kalıcı yazılır.
   *   2. Kilit dışında ÖDE — hata hâlinde sağlayıcıyla mutabakat yapılır.
   *   3. Kilit altında ONAYLA — PAYMENT_IN_PROGRESS → CONFIRMED.
   *
   * Sahiplenmenin kalıcı yazılması şart: yalnızca "kilitli okuyup HELD gördüm"
   * demek iki eşzamanlı isteğin ikisinin de commit sonrası HELD görüp Duffel'a
   * ödeme göndermesini engellemiyordu (aynı bilet iki kez ödenebiliyordu).
   */
  async execute(command: PayHeldFlightCommand): Promise<string> {
    const { bookingId, ctx } = command.payload;

    const claim = await this.claim(bookingId);
    if (claim.kind === 'ALREADY_CONFIRMED') return bookingId;

    // Devralınan (bayat) claim'de ödeme daha önce sağlayıcıya ulaşmış olabilir;
    // yerel durum makinesi tek başına idempotency sağlamaz, Duffel'a sorulur.
    if (claim.kind === 'RECLAIMED') {
      const state = await this.duffelApi.getOrderState(claim.duffelOrderId);
      if (state?.isPaid) {
        this.logger.warn(
          `Yarıda kalmış ödeme sağlayıcıda tamamlanmış, tekrar ödenmiyor: ${bookingId}`
        );
        await this.markConfirmed(bookingId, ctx, state.bookingReference);
        return bookingId;
      }
    }

    try {
      await this.duffelApi.payOrder({
        orderId: claim.duffelOrderId,
        amount: claim.amount,
        currency: claim.currency,
      });
    } catch (error) {
      const settled = await this.settleFailedPayment(
        bookingId,
        claim.duffelOrderId
      );
      // Ödeme aslında geçmişse hata yanıltıcıdır (kopan bağlantı, zaman aşımı):
      // kaydı onaylayıp normal akışa devam ederiz, iade tetiklenmez.
      if (settled !== 'PAID') throw error;
    }

    await this.markConfirmed(bookingId, ctx, null);
    return bookingId;
  }

  /** 1. adım — kilit altında sahiplenme. */
  private async claim(bookingId: string): Promise<PaymentClaim> {
    return this.txManager.run(async () => {
      const booking = await this.flightBookingRepo.findByIdForUpdate(bookingId);
      if (!booking) throw new FlightBookingNotFoundException(bookingId);

      // Zaten onaylanmışsa bu mükerrer bir çağrıdır; Duffel'a ikinci ödeme gitmez.
      if (booking.validate.status.isConfirmed.value) {
        return { kind: 'ALREADY_CONFIRMED' as const };
      }

      const claimed = {
        duffelOrderId: booking.duffelOrderId,
        amount: booking.totalAmount.value.toFixed(2),
        currency: booking.totalAmount.currency,
      };

      if (booking.validate.status.isPaymentInProgress.value) {
        // Canlı bir deneme sürüyorsa ikinci istek beklemeye alınmaz, reddedilir.
        if (!booking.isPaymentClaimStale) {
          throw new FlightPaymentInProgressException(
            bookingId,
            booking.paymentClaimedAt
          );
        }

        // Bayat claim: sahibi çökmüş. Damgayı tazeleyip devralırız.
        booking.releasePaymentClaim();
        booking.markPaymentInProgress();
        await this.flightBookingRepo.update(booking);
        return { kind: 'RECLAIMED' as const, ...claimed };
      }

      if (booking.isHoldExpired) {
        throw new FlightHoldExpiredException(
          booking.holdExpiresAt?.toISOString() ?? ''
        );
      }

      booking.markPaymentInProgress();
      await this.flightBookingRepo.update(booking);

      return { kind: 'FRESH' as const, ...claimed };
    });
  }

  /** 3. adım — kilit altında onay. */
  private async markConfirmed(
    bookingId: string,
    ctx: IGetContext,
    bookingReference: string | null
  ): Promise<void> {
    await this.txManager.run(async () => {
      const booking = await this.flightBookingRepo.findByIdForUpdate(bookingId);
      if (!booking) throw new FlightBookingNotFoundException(bookingId);
      if (booking.validate.status.isConfirmed.value) return;

      booking.confirm({
        bookingReference: bookingReference ?? booking.bookingReference,
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });
      await this.flightBookingRepo.update(booking);
    });
  }

  /**
   * Ödeme hata verdi — para geçti mi geçmedi mi belirsiz. Sağlayıcıya sorulur:
   * - `PAID`   → hata yanıltıcıydı, akış onaya devam eder.
   * - `RELEASED` → para geçmemiş; kayıt HELD'e döner, tekrar denenebilir.
   * - `UNKNOWN`  → sağlayıcıya ulaşılamadı; kayıt PAYMENT_IN_PROGRESS'te BIRAKILIR.
   *   Körlemesine HELD'e döndürmek, ödeme aslında geçmişse ikinci çekim demektir;
   *   takılı kayıt bayat claim süresi dolunca mutabakat yolundan kurtarılır.
   */
  private async settleFailedPayment(
    bookingId: string,
    duffelOrderId: string
  ): Promise<'PAID' | 'RELEASED' | 'UNKNOWN'> {
    let isPaid: boolean;
    try {
      const state = await this.duffelApi.getOrderState(duffelOrderId);
      if (!state) {
        this.logger.error(
          `Ödeme hatası sonrası sipariş sağlayıcıda bulunamadı: ${duffelOrderId}`
        );
        return 'UNKNOWN';
      }
      isPaid = state.isPaid;
    } catch (probeError) {
      this.logger.error(
        `Ödeme durumu doğrulanamadı, kayıt PAYMENT_IN_PROGRESS bırakıldı (${bookingId}): ${
          probeError instanceof Error ? probeError.message : probeError
        }`
      );
      return 'UNKNOWN';
    }

    if (isPaid) return 'PAID';

    await this.txManager.run(async () => {
      const booking = await this.flightBookingRepo.findByIdForUpdate(bookingId);
      if (!booking) return;
      booking.releasePaymentClaim();
      await this.flightBookingRepo.update(booking);
    });

    return 'RELEASED';
  }
}
