import { Module } from '@nestjs/common';
import { BookingPaymentRepositoriesModule } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/repositories.module';
import { BOOKING_PAYMENT_COLLECTION_SERVICE } from '@modules/crm/health-tourism/booking-payment/domain/services/booking-payment-collection/booking-payment-collection.service.interface';
import { BookingPaymentCollectionService } from '@modules/crm/health-tourism/booking-payment/domain/services/booking-payment-collection/booking-payment-collection.service';

/**
 * Rezervasyon ödemesi domain servisleri — **yaprak** modül. Tüketici (banka: kart itirazı)
 * yalnız bunu import eder; `BookingPaymentModule`'ü import etmek controller'ları ve tüm
 * handler'ları da çeker.
 */
@Module({
  imports: [BookingPaymentRepositoriesModule],
  providers: [
    {
      provide: BOOKING_PAYMENT_COLLECTION_SERVICE,
      useClass: BookingPaymentCollectionService,
    },
  ],
  exports: [BOOKING_PAYMENT_COLLECTION_SERVICE],
})
export class BookingPaymentDomainServicesModule {}
