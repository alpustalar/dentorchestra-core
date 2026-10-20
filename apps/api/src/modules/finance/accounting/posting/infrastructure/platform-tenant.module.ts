import { Module } from '@nestjs/common';
import { ChartOfAccountsCommandModule } from '@modules/finance/accounting/chart-of-accounts/application/commands/command.module';
import { PLATFORM_TENANT_PROVIDER } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { PlatformTenantProvider } from './platform-tenant.provider';

/**
 * Platform kiracısını çözen yaprak modül. Posting köprüsü de dönem açan zamanlanmış
 * iş de aynı çözücüye ihtiyaç duyar; ikisinin birbirinin modülünü import etmesi
 * (controller'lar + tüm handler'lar) yerine yalnız bu modül import edilir.
 */
@Module({
  imports: [ChartOfAccountsCommandModule],
  providers: [
    { provide: PLATFORM_TENANT_PROVIDER, useClass: PlatformTenantProvider },
  ],
  exports: [PLATFORM_TENANT_PROVIDER],
})
export class PlatformTenantModule {}
