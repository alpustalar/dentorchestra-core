import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindUninvoicedPaymentsQuery } from './find-uninvoiced-payments.query';
import { FindUninvoicedPaymentsResponse } from './find-uninvoiced-payments.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindCollectedPaymentsQuery } from '@modules/finance/payment/application/queries/find-collected-payments/find-collected-payments.query';
import {
  IInvoiceQueryRepository,
  INVOICE_QUERY_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.query.repository';

/**
 * Tahsilat listesi payment modülünden (QueryBus — bounded context), fatura
 * varlığı kendi tablosundan okunur; eksikler ikisinin farkıdır.
 *
 * Yetki kontrolü payment tarafındaki sorguda yapılır (şube kapsamı); burada
 * ikinci bir kontrol tekrarlanmaz — aynı kararı iki yerde tutmak ikisinin
 * ayrışmasına davettir.
 */
@QueryHandler(FindUninvoicedPaymentsQuery)
export class FindUninvoicedPaymentsHandler implements IQueryHandler<
  FindUninvoicedPaymentsQuery,
  FindUninvoicedPaymentsResponse
> {
  constructor(
    @Inject(INVOICE_QUERY_REPOSITORY)
    private readonly invoiceQueryRepo: IInvoiceQueryRepository,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: FindUninvoicedPaymentsQuery
  ): Promise<FindUninvoicedPaymentsResponse> {
    const { filter, ctx } = query.payload;

    const { data: collected } = await this.queryBus.execute(
      new FindCollectedPaymentsQuery({ filter, ctx })
    );

    if (collected.length === 0) return { data: [] };

    const invoiced = new Set(
      await this.invoiceQueryRepo.findExistingPaymentIds(
        collected.map((row) => row.paymentId)
      )
    );

    return {
      data: collected.filter((row) => !invoiced.has(row.paymentId)),
    };
  }
}
