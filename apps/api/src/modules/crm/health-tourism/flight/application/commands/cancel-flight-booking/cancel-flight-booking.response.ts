import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/** İptalin sonucu + iptal ekonomisi (bkz. CancelHotelBookingResponse). */
export interface CancelFlightBookingResponse {
  /** Duffel sipariş kimliği; kayıt zaten iptalliyse null. */
  orderId: string | null;
  retained: SupplierRetainedCost | null;
}
