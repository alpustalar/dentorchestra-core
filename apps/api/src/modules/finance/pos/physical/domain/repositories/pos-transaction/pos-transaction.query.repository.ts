import {
  FindStalePosTransactionsFilter,
  FindBridgeablePosTransactionsFilter,
  ScanStalePosTransactionsParams,
  StalePosTransactionRow,
  BridgeablePosTransactionRow,
} from '@modules/finance/pos/physical/domain/contracts/pos-transaction';

export const POS_TRANSACTION_QUERY_REPOSITORY = Symbol(
  'IPosTransactionQueryRepository'
);

/**
 * Salt operasyonel raporlar. Para hareketine karar veren okumalar Command
 * Repo'da kalır (`findByIdForUpdate`, `findLiveReversalSummary`,
 * `findPendingForReconcile`); buradaki iki okuma bir ekranı/telafi komutunu
 * besler ve kilit gerektirmez.
 */
export interface IPosTransactionQueryRepository {
  /** Takılı kalmış PENDING işlemler — tüm sağlayıcılar (PAX dışı dahil). */
  findStalePending(
    filter: FindStalePosTransactionsFilter
  ): Promise<StalePosTransactionRow[]>;

  /**
   * Klinik kapsamı olmadan askıda kalmış işlemler — zamanlanmış mutabakat işi
   * görünürlük alarmı için kullanır (bkz. `excludeProviders`).
   */
  findStalePendingAnyClinic(
    params: ScanStalePosTransactionsParams
  ): Promise<StalePosTransactionRow[]>;

  /**
   * Aralıkta başarılı, hastaya bağlı **satış ve ters kayıtlar** — köprü eksiği
   * taramasının girdisi. Ters kayıtlar da listeye girer: onların köprüsü de
   * best-effort yazılıyor ve eksik kalanın telafi edilebilmesi gerekiyor.
   */
  findSuccessfulBridgeable(
    filter: FindBridgeablePosTransactionsFilter
  ): Promise<BridgeablePosTransactionRow[]>;
}
