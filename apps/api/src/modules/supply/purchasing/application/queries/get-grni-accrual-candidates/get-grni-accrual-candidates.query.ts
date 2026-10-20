import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetGrniAccrualCandidatesResponse } from './get-grni-accrual-candidates.response';

/**
 * Yıl sonu GRNI tahakkuk adayları (`asOf` itibarıyla) — mal geldi, fatura gelmedi.
 *
 * Mevcut `GetGoodsReceivedNotInvoicedQuery`dan farkı: o "bugünkü" sapmayı KDV DAHİL verir ve
 * tarihsiz sayaçlardan beslenir; bu sorgu "31 Aralık itibarıyla" teslimi mal kabul günlüğünden,
 * faturayı fatura tarihlerinden hesaplar ve tutarı KDV HARİÇ verir (KDV fatura kesilince doğar).
 * Yıl sonu kapanışının önizlemesi ve kapanış komutu AYNI sorguyu kullanır.
 */
export class GetGrniAccrualCandidatesQuery implements IQuery {
  readonly __responseType!: GetGrniAccrualCandidatesResponse;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly asOf: Date;
      /** Defterin fonksiyonel para birimi: yabancı para birimli sipariş tahakkuk edilemez. */
      readonly functionalCurrency: string;
      readonly ctx: IGetContext;
    }
  ) {}
}
