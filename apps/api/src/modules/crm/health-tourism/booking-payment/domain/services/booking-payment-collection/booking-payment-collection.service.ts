import { Inject, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PaymentProviders } from '@common/constants/payment-provider.constant';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import {
  BookingPaymentNotChargeableException,
  BookingPaymentNotFoundException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import {
  IBookingPaymentCollectionService,
  LockAndGetReversibleAmountParams,
} from './booking-payment-collection.service.interface';

@Injectable()
export class BookingPaymentCollectionService implements IBookingPaymentCollectionService {
  constructor(
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository
  ) {}

  async lockAndGetReversibleAmount(
    params: LockAndGetReversibleAmountParams
  ): Promise<Decimal> {
    const { bookingPaymentId } = params;

    // Kilit sırası HER ZAMAN: önce booking_payments, sonra iade satırı (iade yolları aynı sırayı izler).
    const bp =
      await this.bookingPaymentRepo.findByIdForUpdate(bookingPaymentId);
    if (!bp) throw new BookingPaymentNotFoundException();

    const provider = bp.paidProvider;
    const providerRef = bp.paidProviderRef;
    if (!provider || !providerRef) {
      throw new BookingPaymentNotChargeableException({
        bookingPaymentId,
        reason: 'ödeme tahsil edilmemiş (sağlayıcı referansı yok).',
      });
    }
    // v1: platform sanal POS'u yalnız iyzico/TRY. Stripe canlıya alınmayacak ve kapanış akışı
    // (payout, ücret, dispute) yok; kapalı kanal için itiraz kaydı sahipsiz bir 127 bırakırdı.
    if (provider !== PaymentProviders.IYZICO) {
      throw new BookingPaymentNotChargeableException({
        bookingPaymentId,
        reason: `yalnız iyzico tahsilatı desteklenir (kanal: ${provider}).`,
      });
    }

    const charged = bp.amountChargedBy(provider).value;

    // Tahsilat başına tek iade satırı vardır ((provider, charge_provider_ref) unique). FAILED =
    // sağlayıcı reddetti, para bizde; geri kalan her durum parayı geri götürmüş ya da götürüyor.
    const refund = await this.refundRepo.findByCharge({
      provider,
      chargeProviderRef: providerRef,
    });
    const returned = refund?.countsTowardsReturned
      ? refund.amount.value
      : new Decimal(0);

    return Decimal.max(charged.minus(returned), 0);
  }
}
