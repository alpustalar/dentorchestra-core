import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/**
 * İptalin sonucu + **iptal ekonomisi**.
 *
 * 3rd-party entegrasyon komutu olduğu için `void` değil metadata döner
 * (CLAUDE.md Response Type kuralı): sağlayıcının alıkoyduğu tutar yalnız iptal
 * yanıtında bir kez öğrenilebilir (iptal çağrısı idempotent değil, ikinci DELETE
 * hata verir) ve iade akışı onu platform defterine yazmak zorundadır.
 */
export interface CancelHotelBookingResponse {
  /** Sağlayıcı referansı; kayıt zaten iptalliyse null (çağrı yapılmadı). */
  reference: string | null;
  /** Sağlayıcının alıkoyduğu ceza; bilinmiyorsa null (bkz. handler notu). */
  retained: SupplierRetainedCost | null;
}
