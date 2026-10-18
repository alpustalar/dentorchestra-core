import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { AccountingPeriodTransitionListener } from './listeners';

/**
 * Dönem olaylarının dinleyicisi. Publisher yok: olaylar **entity içinde** raise
 * edilir (`AccountingPeriod.lock/reopen/close`) ve repository'nin koşullu geçişi
 * başarılı olduğunda `flushEvents()` ile ALS'ye yazılır — geçiş uygulanmazsa
 * olay da yayınlanmaz.
 */
@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [AccountingPeriodTransitionListener],
})
export class AccountingPeriodEventModule {}
