import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import {
  FinancialEventRecordedListener,
  JournalEntryReversedListener,
} from './listeners';

/**
 * Posting modülünün dinleyicileri:
 *  - `FinancialEventRecordedListener` — ekonomik olay → yevmiye fişi köprüsü.
 *    Bu modül bağlı değilken listener hiçbir modülün provider'ı olmadığı için
 *    `@OnEvent` aboneliği hiç kurulmuyordu: olaylar kaydediliyor, fiş hiç
 *    üretilmiyordu.
 *  - `JournalEntryReversedListener` — storno denetim izi (audit log).
 */
@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [FinancialEventRecordedListener, JournalEntryReversedListener],
})
export class PostingEventModule {}
