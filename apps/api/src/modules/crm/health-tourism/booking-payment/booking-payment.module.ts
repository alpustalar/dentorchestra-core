import { Module } from '@nestjs/common';
import { BookingPaymentPresentationModule } from './presentation/presentation.module';
import { BookingPaymentEventModule } from './infrastructure/messaging/events/booking-payment-event.module';

// BookingPaymentEventModule: iade elle-karar / yeniden-deneme denetim dinleyicisi. Bir
// dinleyici hiçbir modül grafiğine bağlı değilse `emitAsync` sıfır dinleyiciye yayın yapar ve
// kural 7'nin denetim izi sessizce kaybolur (kural 15b) — kayıt app.module.spec ile kilitli.
@Module({
  imports: [BookingPaymentPresentationModule, BookingPaymentEventModule],
})
export class BookingPaymentModule {}
