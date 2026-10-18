import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { BackfillLedgerEntriesCommand } from './backfill-ledger-entries.command';
import { BackfillLedgerEntriesResponse } from './backfill-ledger-entries.response';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindLedgerMismatchesQuery } from '@modules/finance/finance-ledger/application/queries/find-ledger-mismatches/find-ledger-mismatches.query';
import { SyncInstallmentLedgerEntryCommand } from '@modules/finance/finance-ledger/application/commands/sync-installment-ledger-entry/sync-installment-ledger-entry.command';

/**
 * Aday listesi okuma tarafından gelir (rapor); **nihai kontrol** telafi edilen
 * her kayıt için `SyncInstallmentLedgerEntryCommand`'in kendi içindedir:
 * taksitin durumu Command Context'te yeniden okunur, son güvence DB'deki
 * unique kısıttır. Yani bu komut yarış durumunda mükerrer kayıt üretemez.
 *
 * Tek bir taksitin hatası turu durdurmaz: kalanlar denenir, başarısızlar
 * gerekçesiyle dönülür (operatör neyin elde kaldığını görür).
 */
@CommandHandler(BackfillLedgerEntriesCommand)
export class BackfillLedgerEntriesHandler implements ICommandHandler<
  BackfillLedgerEntriesCommand,
  BackfillLedgerEntriesResponse
> {
  private readonly logger = new Logger(BackfillLedgerEntriesHandler.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    command: BackfillLedgerEntriesCommand
  ): Promise<BackfillLedgerEntriesResponse> {
    const { filter, ctx } = command.payload;

    const { data: mismatches } = await this.queryBus.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );

    const failed: BackfillLedgerEntriesResponse['failed'] = [];
    let recorded = 0;
    let synced = 0;

    for (const row of mismatches) {
      try {
        const { outcome } = await this.commandBus.execute(
          new SyncInstallmentLedgerEntryCommand({
            installmentId: row.installmentId,
            // Telafi turunda tahsilatı yapan personel bilinmiyor: kaydın
            // damgası boş bırakılır, turu çalıştıran kişi audit log'da durur.
            actorId: null,
            ctx,
          })
        );

        if (outcome === 'RECORDED') recorded += 1;
        if (outcome === 'SYNCED') synced += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Cari kaydı telafi edilemedi: installmentId=${row.installmentId}`,
          error
        );
        failed.push({ installmentId: row.installmentId, reason });
      }
    }

    return { attempted: mismatches.length, recorded, synced, failed };
  }
}
