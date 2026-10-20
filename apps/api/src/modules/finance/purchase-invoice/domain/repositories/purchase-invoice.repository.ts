import { Pagination } from '@shared';
import { PurchaseInvoice as IPurchaseInvoice } from '@shared';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import {
  FindInvoiceAmountsByOrdersFilter,
  PurchaseInvoiceOrderAmount,
} from '@modules/finance/purchase-invoice/domain/contracts/purchase-invoice';

export const PURCHASE_INVOICE_COMMAND_REPOSITORY = Symbol(
  'IPurchaseInvoiceCommandRepository'
);
export const PURCHASE_INVOICE_QUERY_REPOSITORY = Symbol(
  'IPurchaseInvoiceQueryRepository'
);

export interface IPurchaseInvoiceCommandRepository extends IBaseCommandRepository<PurchaseInvoice> {
  /**
   * Satır kilidiyle okur. Sipariş eşleştirme/koparma faturanın `purchaseOrderId`
   * alanına bakıp siparişin kümülatif `invoicedTotal` sayacını değiştiriyor;
   * kilitsiz okumada iki eşzamanlı istek de faturayı "eşleşmemiş" görüp aynı
   * tutarı siparişe İKİ KEZ ekleyebilir.
   */
  findByIdForUpdate(id: string): Promise<PurchaseInvoice | null>;
}

/** Okuma tarafı: entity değil, plain model döner (veri HTTP sınırını geçiyor). */
export interface IPurchaseInvoiceQueryRepository {
  findManyByClinic(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IPurchaseInvoice[]; total: number }>;

  /**
   * Siparişlere bağlı faturaların tutarları, `asOf` itibarıyla (yıl sonu GRNI tahakkuku).
   *
   * `paginate` KULLANILMAZ: bu bir liste ekranı değil, **bakiye** hesabının girdisidir —
   * sayfalansaydı sipariş başına faturalanan tutar eksik toplanır, tahakkuk fazla çıkardı.
   * Küme sipariş kimlikleriyle sınırlıdır (çağıran kliniğin teslim görmüş siparişleri).
   */
  findAmountsByOrderIdsAsOf(
    filter: FindInvoiceAmountsByOrdersFilter
  ): Promise<PurchaseInvoiceOrderAmount[]>;
}
