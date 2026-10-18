import { Module } from '@nestjs/common';
import { PostingRepositoriesModule } from '@modules/finance/accounting/posting/infrastructure/persistence/prisma/repositories/repositories.module';
import { AccountRepositoriesModule } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/repositories.module';
import { FUNDS_IN_TRANSIT_GATE } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate.interface';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';

/**
 * Posting domain servisleri — **yaprak** modül (dönem servislerindeki desenin
 * aynısı). Tüketici (banka modülü, hesap kapaması) yalnız bunu import eder;
 * `PostingModule`'ü import etmek controller'ları, rapor handler'larını ve kuyruk
 * işçilerini de beraberinde çeker ve döngü riski üretir.
 */
@Module({
  imports: [PostingRepositoriesModule, AccountRepositoriesModule],
  providers: [
    {
      provide: FUNDS_IN_TRANSIT_GATE,
      useClass: FundsInTransitGate,
    },
  ],
  exports: [FUNDS_IN_TRANSIT_GATE],
})
export class PostingDomainServicesModule {}
