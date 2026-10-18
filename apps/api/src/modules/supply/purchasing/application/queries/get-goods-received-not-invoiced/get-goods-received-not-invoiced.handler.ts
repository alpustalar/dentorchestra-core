import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetGoodsReceivedNotInvoicedQuery } from './get-goods-received-not-invoiced.query';
import { GetGoodsReceivedNotInvoicedResponse } from './get-goods-received-not-invoiced.response';
import {
  IPurchaseOrderQueryRepository,
  PURCHASE_ORDER_QUERY_REPOSITORY,
} from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { buildGoodsReceiptVarianceReport } from '@modules/supply/purchasing/domain/rules/purchase-order-billing.rules';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

/**
 * Entity hidrate edilmez: hesap saf `purchase-order-billing.rules` fonksiyonlarıyla
 * okuma modeli üzerinden yapılır ve tek sipariş özetiyle **aynı** fonksiyonu
 * kullanır (iki yerde hesaplanan sapma sessizce ayrışırdı).
 *
 * Yetki **finans** tarafında: rapor tedarikçi başına tutar ve ay sonu tahakkuk
 * adayı üretiyor. Satın alma yetkisi "sipariş geçebilir" demek; "klinikte
 * faturalanmamış ne kadar borç birikmiş" sorusu muhasebenin alanıdır (envanter
 * değerlemesiyle aynı ölçüt — bkz. `GetInventoryValuationQuery`).
 */
@QueryHandler(GetGoodsReceivedNotInvoicedQuery)
export class GetGoodsReceivedNotInvoicedHandler implements IQueryHandler<
  GetGoodsReceivedNotInvoicedQuery,
  GetGoodsReceivedNotInvoicedResponse
> {
  constructor(
    @Inject(PURCHASE_ORDER_QUERY_REPOSITORY)
    private readonly poQueryRepo: IPurchaseOrderQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetGoodsReceivedNotInvoicedQuery
  ): Promise<GetGoodsReceivedNotInvoicedResponse> {
    const { clinicId, ctx } = query;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('purchase-order.goods-received-not-invoiced');

    const orders =
      await this.poQueryRepo.findReceiptVarianceCandidates(clinicId);

    return {
      data: buildGoodsReceiptVarianceReport({
        clinicId,
        asOf: DateTimeManager.create(),
        orders: orders.map((order) => ({
          id: order.id,
          supplierId: order.supplierId,
          orderDate: order.orderDate,
          currency: order.currency,
          status: order.status,
          billingStatus: order.billingStatus,
          grandTotal: order.grandTotal,
          invoicedTotal: order.invoicedTotal,
          lines: order.items.map((item) => ({
            quantityReceived: item.quantityReceived,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
          })),
        })),
      }),
    };
  }
}
