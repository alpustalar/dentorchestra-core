import { FinanceLedgerEntity } from '@modules/finance/finance-ledger/domain/entities/finance-ledger.entity';

export const FINANCE_LEDGER_COMMAND_REPOSITORY = Symbol(
  'IFinanceLedgerCommandRepository'
);

/**
 * Cari defterin yazma tarafı.
 *
 * Durum değişikliği **entity üzerinden** yapılır (`findByInstallmentId` →
 * `syncStatus` → `update`): daha önce `updateStatusByInstallmentId` adlı ham
 * bir `updateMany` vardı ve entity'nin geçiş kurallarını baypas ederek iade
 * edilmiş bir kaydı yeniden gelire çevirebiliyordu. Ayrıca 0 satır güncellemek
 * sessizce "başarılı" sayılıyordu — kayıt henüz yazılmamışken gelen iade
 * böyle kayboluyordu.
 */
export interface IFinanceLedgerCommandRepository {
  create(entry: FinanceLedgerEntity): Promise<FinanceLedgerEntity>;
  update(entry: FinanceLedgerEntity): Promise<FinanceLedgerEntity>;

  /**
   * Taksitin cari kaydı (yazma kararını besler → Command Repo).
   * `installmentId` DB'de unique: taksit başına en fazla bir kayıt.
   */
  findByInstallmentId(
    installmentId: string
  ): Promise<FinanceLedgerEntity | null>;
}
