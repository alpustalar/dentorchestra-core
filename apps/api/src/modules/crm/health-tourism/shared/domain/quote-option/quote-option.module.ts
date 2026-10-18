import { Module } from '@nestjs/common';
import { QUOTE_OPTION_OWNERSHIP_SERVICE } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service.interface';
import { QuoteOptionOwnershipService } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service';

/**
 * Yaprak modül: teklif sahipliği kapısını üç dikeye sağlar. Dikeyler yalnız bunu
 * import eder (sahibin ana modülünü değil — bkz. CLAUDE.md domain-servis kuralı).
 */
@Module({
  // `CriticalFailureModule` @Global — ayrıca import edilmez (app.module'de bir kez).
  providers: [
    {
      provide: QUOTE_OPTION_OWNERSHIP_SERVICE,
      useClass: QuoteOptionOwnershipService,
    },
  ],
  exports: [QUOTE_OPTION_OWNERSHIP_SERVICE],
})
export class QuoteOptionModule {}
