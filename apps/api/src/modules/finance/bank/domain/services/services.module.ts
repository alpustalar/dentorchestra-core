import { Module } from '@nestjs/common';
import { BankRepositoriesModule } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/repositories.module';
import { CARD_CHARGEBACK_EXPOSURE_GUARD } from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { CardChargebackExposureGuard } from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard';

/**
 * Banka domain servisleri — **yaprak** modül. Tüketiciler (POS iade/iptal,
 * sanal POS iade/iptal) yalnız bunu import eder; `BankModule`'ü import etmek
 * controller'ları ve tüm handler'ları da çeker, modül grafiğini şişirir ve
 * döngü riski üretir.
 */
@Module({
  imports: [BankRepositoriesModule],
  providers: [
    {
      provide: CARD_CHARGEBACK_EXPOSURE_GUARD,
      useClass: CardChargebackExposureGuard,
    },
  ],
  exports: [CARD_CHARGEBACK_EXPOSURE_GUARD],
})
export class BankDomainServicesModule {}
