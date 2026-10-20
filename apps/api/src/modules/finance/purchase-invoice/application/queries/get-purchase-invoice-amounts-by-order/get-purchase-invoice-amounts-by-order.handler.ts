import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IPurchaseInvoiceQueryRepository,
  PURCHASE_INVOICE_QUERY_REPOSITORY,
} from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { GetPurchaseInvoiceAmountsByOrderQuery } from './get-purchase-invoice-amounts-by-order.query';
import { GetPurchaseInvoiceAmountsByOrderResponse } from './get-purchase-invoice-amounts-by-order.response';

@QueryHandler(GetPurchaseInvoiceAmountsByOrderQuery)
export class GetPurchaseInvoiceAmountsByOrderHandler implements IQueryHandler<
  GetPurchaseInvoiceAmountsByOrderQuery,
  GetPurchaseInvoiceAmountsByOrderResponse
> {
  constructor(
    @Inject(PURCHASE_INVOICE_QUERY_REPOSITORY)
    private readonly purchaseInvoiceQueryRepo: IPurchaseInvoiceQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetPurchaseInvoiceAmountsByOrderQuery
  ): Promise<GetPurchaseInvoiceAmountsByOrderResponse> {
    const { clinicId, orderIds, asOf, ctx } = query.payload;

    // `clinicId` çağıran modülden geliyor — aktörün kendi kliniği olmak zorunda değil.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('purchase-invoice.amounts-by-order');

    const data = await this.purchaseInvoiceQueryRepo.findAmountsByOrderIdsAsOf({
      clinicId,
      orderIds,
      asOf,
    });

    return { data };
  }
}
