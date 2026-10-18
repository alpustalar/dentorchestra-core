import { ICommand } from '@nestjs/cqrs';
import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/**
 * Rezervasyon iptal edilince müşteriye iade başlatır. `bookingId` = sağlayıcı
 * rezervasyonunun dahili kaydı (BookingPayment.bookingId). Ödeme hangi
 * sağlayıcıyla alındıysa o sağlayıcıdan iade edilir.
 *
 * v1: müşteriye **tam satış tutarı** iade edilir — iptal cezası satış fiyatından
 * mahsup edilmez. Bu bir fiyat politikası kararıdır ve burada değişmez; ama
 * cezanın platform defterinde **zarar olarak görünmesi** kararın bedelini
 * ölçülebilir kılar (bkz. `supplierRetained`).
 *
 * `retained` iki alanlı bir sözleşme değil, **üç durumlu** bir cevaptır:
 *   - tutar       → sağlayıcı cezayı bildirdi,
 *   - `{amount:'0.00'}` → sağlayıcı ceza almadı (ücretsiz iptal),
 *   - `null`      → sağlayıcı bildirmedi/bilinmiyor → defter cezasız ters kayıt
 *                   yazar ve fark alarmla duyurulur.
 * Alan **zorunludur** (opsiyonel değil): her çağıran bu soruyu yanıtlamak
 * zorunda kalsın, cevap sessizce "ceza yok"a düşmesin.
 */
export class RefundBookingPaymentCommand implements ICommand {
  constructor(
    public readonly payload: {
      readonly bookingId: string;
      readonly retained: SupplierRetainedCost | null;
      readonly reason?: string;
    }
  ) {}
}
