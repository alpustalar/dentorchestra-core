import { Module } from '@nestjs/common';
import { CHARGE_TOTALS_SERVICE } from './charge-totals.service.interface';
import { LocalChargeTotalsService } from './local-charge-totals.service';
import { TreatmentChargeRepositoryModule } from '@modules/finance/treatment-charge/infrastructure/persistence/prisma/repositories/treatment-charge/treatment-charge.repository.module';

/**
 * Yaprak modül: tüketiciler (invoice, payment) yalnız bunu import eder.
 * `TreatmentChargeModule`'ü import etmek controller'ları ve tüm handler'ları
 * da beraberinde çeker (modül grafiğini şişirir + döngü riski).
 */
@Module({
  imports: [TreatmentChargeRepositoryModule],
  providers: [
    { provide: CHARGE_TOTALS_SERVICE, useClass: LocalChargeTotalsService },
  ],
  exports: [CHARGE_TOTALS_SERVICE],
})
export class ChargeTotalsServiceModule {}
