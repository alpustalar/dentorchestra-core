import { PaymentInitiatedEventPayload } from '@modules/finance/payment/domain/events/payment-initiated.event';
import { PaymentCancelledEventPayload } from '@modules/finance/payment/domain/events/payment-cancelled.event';

export const PAYMENT_EVENT_PUBLISHER = Symbol('IPaymentEventPublisher');

/**
 * Ödeme aggregate'inin **dışında** kalan olaylar için yayıncı.
 *
 * Tahsilat / iade / başarısızlık event'leri burada YOK: onları `Payment` entity
 * durum geçişinde kendisi raise eder (bkz. CLAUDE.md "Events Raised in Entity").
 * Publisher üzerinden de yayınlanabilir olmaları, aynı olayın iki kaynaktan
 * çıkmasına ve muhasebe ters kaydının iki kez koşmasına yol açıyordu; metodları
 * bilerek kaldırıldı ki bu hata tekrar yazılamasın.
 */
export interface IPaymentEventPublisher {
  /** Ödeme işlemi başlatıldığında (sanal POS formu açıldığında) tetiklenir. */
  paymentInitiated(payload: PaymentInitiatedEventPayload): void;

  /** Ödeme işlemi kullanıcı veya sistem tarafından iptal edildiğinde tetiklenir. */
  paymentCancelled(payload: PaymentCancelledEventPayload): void;
}
