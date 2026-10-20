import { QueryResponse } from '@shared/common/response/response.interface';
import { UnresolvedBookingPaymentRefundRow } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';

/**
 * Kapanmamış rezervasyon iadeleri (kural 4: "eksik kalanlar" sorgusu). Her satır, operatörün
 * sağlayıcı panelinde aratıp karar vereceği `idempotencyKey`'i taşır.
 */
export type FindUnresolvedBookingPaymentRefundsResponse = QueryResponse<
  UnresolvedBookingPaymentRefundRow[]
>;
