import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentProviderValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';

export const BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY = Symbol(
  'IBookingPaymentRefundCommandRepository'
);

export interface IBookingPaymentRefundCommandRepository extends IBaseCommandRepository<BookingPaymentRefund> {
  /**
   * İade satırını `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   * Kilit sırası HER ZAMAN: önce `booking_payments`, sonra bu satır (ters sıra kilitlenmeye
   * yol açar).
   */
  findByIdForUpdate(id: string): Promise<BookingPaymentRefund | null>;

  /** Aynı tahsilat için iade zaten talep edilmiş mi? (`provider`, `chargeProviderRef`) tektir. */
  findByCharge(params: {
    provider: BookingPaymentProviderValue;
    chargeProviderRef: string;
  }): Promise<BookingPaymentRefund | null>;
}
