import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { BookingPaymentRefundAuditListener } from './listeners';

/**
 * Publisher yok: iade event'leri entity içinde `addDomainEvent` ile raise ediliyor ve repo
 * `update()` içinde flush ediliyor. Bu modül yalnız dinleyiciyi ayağa kaldırır.
 */
@Module({
  imports: [AuditLogModule],
  providers: [BookingPaymentRefundAuditListener],
})
export class BookingPaymentEventModule {}
