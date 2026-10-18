import { Decimal } from 'decimal.js';
import { taxSpecificationOf } from '@modules/finance/invoice/domain/rules/invoice-tax';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetInvoiceByIdQuery } from './get-invoice-by-id.query';
import { GetInvoiceByIdResponse } from './get-invoice-by-id.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IInvoiceQueryRepository,
  INVOICE_QUERY_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.query.repository';

@QueryHandler(GetInvoiceByIdQuery)
export class GetInvoiceByIdHandler implements IQueryHandler<
  GetInvoiceByIdQuery,
  GetInvoiceByIdResponse
> {
  constructor(
    @Inject(INVOICE_QUERY_REPOSITORY)
    private readonly invoiceRepo: IInvoiceQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetInvoiceByIdQuery): Promise<GetInvoiceByIdResponse> {
    const { ctx } = query;
    const invoice = await this.invoiceRepo.findById(query.invoiceId);
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    if (!invoice) {
      return {
        data: null,
        meta: {
          serializationOptions: policy.getSerializationOptions({
            clinicId: ctx.actor.clinicId ?? '',
          }),
        },
      };
    }

    // Fatura başka kliniğe aitse detay sızmaz — klinik bağı kaydın kendisinden çözülür.
    evaluator
      .check(
        (p) => p.canAccessClinicFinances(invoice.clinicId),
        'Bu faturaya erişim yetkiniz yok.'
      )
      .orThrow('invoice.detail');

    const tax = taxSpecificationOf(invoice);
    return {
      data: {
        id: invoice.id,
        organizationId: invoice.organizationId,
        clinicId: invoice.clinicId,
        patientId: invoice.patientId,
        netTotal: tax.netAmount.value.toFixed(2),
        vatTotal: tax.taxAmount.value.toFixed(2),
        grandTotal: tax.grossAmount.value.toFixed(2),
        vatRate: new Decimal(invoice.vatRate),
        currency: invoice.currency,
        issuedAt: invoice.issuedAt,
        status: invoice.status,
        cancelledAt: invoice.cancelledAt,
        cancelReason: invoice.cancelReason,
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: invoice.clinicId,
        }),
      },
    };
  }
}
