import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  IPurchaseOrderQueryRepository,
  PURCHASE_ORDER_QUERY_REPOSITORY,
} from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { buildGrniAccrualReport } from '@modules/supply/purchasing/domain/rules/grni-accrual.rules';
import { GetPurchaseInvoiceAmountsByOrderQuery } from '@modules/finance/purchase-invoice/application/queries/get-purchase-invoice-amounts-by-order/get-purchase-invoice-amounts-by-order.query';
import { GetGrniAccrualCandidatesQuery } from './get-grni-accrual-candidates.query';
import { GetGrniAccrualCandidatesResponse } from './get-grni-accrual-candidates.response';

/**
 * Siparişler ve kabuller bu modülün günlüğünden, faturalar alış faturası modülünden (QueryBus)
 * okunur — modüller arası tablo erişimi yok. Hesap saf kuraldadır (`grni-accrual.rules.ts`).
 *
 * Yetki **finans** tarafında: sonuç yıl sonu defterine fiş yazılmasının girdisidir; "sipariş
 * görebilmek" bunu kapsamaz (bkz. `GetGoodsReceivedNotInvoicedHandler`).
 */
@QueryHandler(GetGrniAccrualCandidatesQuery)
export class GetGrniAccrualCandidatesHandler implements IQueryHandler<
  GetGrniAccrualCandidatesQuery,
  GetGrniAccrualCandidatesResponse
> {
  constructor(
    @Inject(PURCHASE_ORDER_QUERY_REPOSITORY)
    private readonly poQueryRepo: IPurchaseOrderQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: GetGrniAccrualCandidatesQuery
  ): Promise<GetGrniAccrualCandidatesResponse> {
    const { clinicId, asOf, functionalCurrency, ctx } = query.payload;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('purchase-order.grni-accrual-candidates');

    const orders = await this.poQueryRepo.findGrniAccrualOrders({
      clinicId,
      asOf,
    });

    const { data: invoices } = await this.queryBus.execute(
      new GetPurchaseInvoiceAmountsByOrderQuery({
        clinicId,
        orderIds: orders.map((order) => order.id),
        asOf,
        ctx,
      })
    );

    const invoicesByOrder = new Map<string, typeof invoices>();
    for (const invoice of invoices) {
      const list = invoicesByOrder.get(invoice.purchaseOrderId) ?? [];
      list.push(invoice);
      invoicesByOrder.set(invoice.purchaseOrderId, list);
    }

    const report = buildGrniAccrualReport({
      functionalCurrency,
      orders: orders.map((order) => ({
        id: order.id,
        supplierId: order.supplierId,
        orderDate: order.orderDate,
        currency: order.currency,
        items: order.items,
        receipts: order.receipts,
        invoices: (invoicesByOrder.get(order.id) ?? []).map((invoice) => ({
          netTotal: invoice.netTotal,
          lineAccountCode: invoice.lineAccountCode,
        })),
      })),
    });

    return {
      data: {
        clinicId,
        asOf,
        candidates: report.candidates,
        invoicedNotReceived: report.invoicedNotReceived,
      },
    };
  }
}
