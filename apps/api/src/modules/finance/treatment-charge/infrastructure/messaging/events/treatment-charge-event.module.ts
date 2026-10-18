import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { TreatmentChargeLifecycleListener } from '@modules/finance/treatment-charge/infrastructure/messaging/events/listeners/treatment-charge-lifecycle.listener';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [TreatmentChargeLifecycleListener],
})
export class TreatmentChargeEventModule {}
