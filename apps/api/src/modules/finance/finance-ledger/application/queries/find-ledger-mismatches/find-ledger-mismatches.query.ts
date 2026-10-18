import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindLedgerMismatchesResponse } from './find-ledger-mismatches.response';
import { FindLedgerMismatchesFilter } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';

/**
 * Kaynak (taksit) ↔ cari defter mutabakatı: parası hareket etmiş ama defterde
 * karşılığı olmayan (`MISSING`) ya da durumu kaynaktan kaymış (`STATUS_DRIFT`)
 * taksitler.
 *
 * "Yutulan kritik iş için görünürlük" gereğini karşılar (CLAUDE.md finans
 * kuralı 4): cari kayıt olay güdümlü ve kuyruk üzerinden yazılıyor. Kuyruğa
 * hiç girememiş (listener hatayı yutuyor + alarm) ya da 5 denemede de
 * başarısız olmuş iş **kalıcı olarak** yapılmamış kalıyordu; eksikleri
 * gösteren tek yer BullMQ'nun failed set'iydi.
 */
export class FindLedgerMismatchesQuery implements IQuery {
  readonly __responseType!: FindLedgerMismatchesResponse;
  constructor(
    public readonly payload: {
      readonly filter: FindLedgerMismatchesFilter;
      readonly ctx: IGetContext;
    }
  ) {}
}
