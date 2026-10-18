import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/** İptalin sonucu + iptal ekonomisi (bkz. CancelHotelBookingResponse). */
export interface CancelTransferBookingResponse {
  reference: string | null;
  retained: SupplierRetainedCost | null;
}
