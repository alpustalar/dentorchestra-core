import { Module } from '@nestjs/common';
import { HealthTourismPresentationModule } from './presentation/presentation.module';
import { HealthTourismConfigModule } from '@modules/crm/health-tourism/config/config.module';
import { BookingPaymentModule } from '@modules/crm/health-tourism/booking-payment/booking-payment.module';

/**
 * Sağlık turizmi çatısı: otel (HotelBeds), transfer (HotelBeds), uçuş (Duffel),
 * klinik-başı config ve ödeme-önce rezervasyon saga'sı.
 *
 * Config ve booking-payment burada import edilir — ikisi de yalnız bus üzerinden
 * tüketiliyor (controller'ı olan uçlar kendi presentation modüllerinde), bu yüzden
 * çatıya bağlanmazlarsa handler'ları DI grafiğine hiç girmiyordu.
 */
@Module({
  imports: [
    HealthTourismPresentationModule,
    HealthTourismConfigModule,
    BookingPaymentModule,
  ],
})
export class HealthTourismModule {}
