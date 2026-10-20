import { Module } from '@nestjs/common';
import { PaymentRepositoryModule } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/payment/payment.repository.module';
import { PAYMENT_COLLECTION_SERVICE } from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service.interface';
import { PaymentCollectionService } from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service';

/**
 * Ödeme domain servisleri — **yaprak** modül. Tüketici (kart itirazı) yalnız bunu
 * import eder; `PaymentModule`'ü import etmek controller'ları ve tüm handler'ları
 * da çeker, modül grafiğini şişirir ve döngü riski üretir.
 */
@Module({
  imports: [PaymentRepositoryModule],
  providers: [
    {
      provide: PAYMENT_COLLECTION_SERVICE,
      useClass: PaymentCollectionService,
    },
  ],
  exports: [PAYMENT_COLLECTION_SERVICE],
})
export class PaymentDomainServicesModule {}
