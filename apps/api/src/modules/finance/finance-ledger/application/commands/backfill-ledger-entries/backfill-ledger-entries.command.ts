import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { BackfillLedgerEntriesResponse } from './backfill-ledger-entries.response';
import { FindLedgerMismatchesFilter } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';

/**
 * Cari defterin kaynaktan kaymış kayıtlarını onarır (telafi / backfill).
 *
 * Cari kayıt olay güdümlü yazılıyor ve tetikleyici listener hatayı yutuyor
 * (CRITICAL alarm + elle müdahale). CLAUDE.md finans kuralı 4 yutulan her
 * kritik iş için ya retry ya **backfill + eksikler sorgusu** istiyor: sorgu
 * `FindLedgerMismatchesQuery`, telafi yolu bu komut.
 *
 * Her satır `SyncInstallmentLedgerEntryCommand` ile onarılır; o komut
 * idempotent ve sıraya duyarsız olduğu için tur tekrar tekrar çalıştırılabilir
 * ve iade edilmiş bir kaydı asla gelire çeviremez.
 */
export class BackfillLedgerEntriesCommand implements ICommand {
  readonly __responseType!: BackfillLedgerEntriesResponse;
  constructor(
    public readonly payload: {
      readonly filter: FindLedgerMismatchesFilter;
      readonly ctx: IGetContext;
    }
  ) {}
}
