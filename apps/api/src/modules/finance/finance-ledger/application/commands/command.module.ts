import { Module } from '@nestjs/common';
import { SyncInstallmentLedgerEntryHandler } from './sync-installment-ledger-entry/sync-installment-ledger-entry.handler';
import { BackfillLedgerEntriesHandler } from './backfill-ledger-entries/backfill-ledger-entries.handler';
import { FinanceLedgerRepositoriesModule } from '@modules/finance/finance-ledger/infrastructure/persistence/prisma/repositories/repositories.module';

/**
 * Cari defterin tek yazma yolu `SyncInstallmentLedgerEntryHandler`'dır:
 * tahsilat/iade olayları ve telafi turu aynı idempotent komutu kullanır
 * (sıraya duyarsız). Eski `CreateLedgerEnty` + `RefundLedgerEntries` ikilisi
 * iki ayrı yazma yolu olduğu için iadeyi kaybedebiliyordu.
 */
const CommandHandlers = [
  SyncInstallmentLedgerEntryHandler,
  BackfillLedgerEntriesHandler,
];

@Module({
  imports: [FinanceLedgerRepositoriesModule],
  providers: [...CommandHandlers],
  exports: [...CommandHandlers],
})
export class FinanceLedgerCommandModule {}
