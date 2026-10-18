import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { PurchaseOrder } from '@modules/supply/purchasing/domain/entities/purchase-order.entity';
import {
  FindPurchaseOrdersFilter,
  PurchaseOrderWithItems,
} from '@modules/supply/purchasing/domain/contracts';
import { Paginated } from '@common/interfaces/paginated.type';

export const PURCHASE_ORDER_COMMAND_REPOSITORY = Symbol(
  'IPurchaseOrderCommandRepository'
);
export const PURCHASE_ORDER_QUERY_REPOSITORY = Symbol(
  'IPurchaseOrderQueryRepository'
);

export interface IPurchaseOrderCommandRepository extends IBaseCommandRepository<PurchaseOrder> {
  /**
   * Siparişi kalemleriyle birlikte `FOR UPDATE` kilitleyerek yükler — yalnız aktif
   * transaction içinde.
   *
   * Mal kabul kümülatif bir sayaçtır (`quantityReceived`): aynı sipariş için iki
   * eşzamanlı kabul isteği kilitsiz okursa ikisi de aynı "kalan miktar"ı görür,
   * ikisi de stok girişi tetikler → depoya olmayan mal girer.
   */
  findByIdForUpdate(id: string): Promise<PurchaseOrder | null>;
}

export interface IPurchaseOrderQueryRepository {
  findById(id: string): Promise<PurchaseOrderWithItems | null>;
  findByClinic(
    filter: FindPurchaseOrdersFilter
  ): Promise<Paginated<PurchaseOrderWithItems>>;

  /**
   * Mal kabul ↔ fatura sapması taşıyabilecek siparişler: **herhangi** bir teslim
   * ya da **herhangi** bir fatura eşleşmesi olanlar. Hiç teslim alınmamış ve hiç
   * faturalanmamış siparişin (taslak / gönderilmiş / iptal) sapması tanım gereği
   * sıfırdır.
   *
   * `paginate` **kullanılmaz** (bkz. `findExistingSourceRefIds` deseni): bu bir
   * liste ekranı değil, bir **bakiye** mutabakatının girdi kümesidir. Sayfalansaydı
   * para birimi başına toplamlar yalnız o sayfanın toplamı olurdu — ay sonunda
   * tahakkuk edilecek tutar sessizce eksik çıkardı.
   */
  findReceiptVarianceCandidates(
    clinicId: string
  ): Promise<PurchaseOrderWithItems[]>;
}
