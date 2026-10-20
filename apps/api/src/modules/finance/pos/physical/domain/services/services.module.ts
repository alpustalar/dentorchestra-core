import { Module } from '@nestjs/common';
import { PosTransactionRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-transaction/pos-transaction.repository.module';
import { POS_CARD_COLLECTION_SERVICE } from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service.interface';
import { PosCardCollectionService } from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service';

/**
 * Fiziksel POS domain servisleri — **yaprak** modül. Tüketici (kart itirazı)
 * yalnız bunu import eder; `PhysicalPosModule`'ü import etmek controller'ları
 * ve tüm handler'ları da çeker, modül grafiğini şişirir ve döngü riski üretir.
 */
@Module({
  imports: [PosTransactionRepositoryModule],
  providers: [
    {
      provide: POS_CARD_COLLECTION_SERVICE,
      useClass: PosCardCollectionService,
    },
  ],
  exports: [POS_CARD_COLLECTION_SERVICE],
})
export class PosDomainServicesModule {}
