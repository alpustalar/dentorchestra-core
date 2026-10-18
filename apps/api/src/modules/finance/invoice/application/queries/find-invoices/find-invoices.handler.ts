import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindInvoicesQuery } from './find-invoices.query';
import { FindInvoicesResponse } from './find-invoices.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import { Invoice as IInvoice } from '@shared';
import { taxSpecificationOf } from '@modules/finance/invoice/domain/rules/invoice-tax';
import { InvoiceListItem } from '@modules/finance/invoice/domain/contracts/invoice';
import {
  IInvoiceQueryRepository,
  INVOICE_QUERY_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.query.repository';

@QueryHandler(FindInvoicesQuery)
export class FindInvoicesHandler implements IQueryHandler<
  FindInvoicesQuery,
  FindInvoicesResponse
> {
  constructor(
    @Inject(INVOICE_QUERY_REPOSITORY)
    private readonly invoiceRepo: IInvoiceQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: FindInvoicesQuery): Promise<FindInvoicesResponse> {
    const { pagination, ctx, clinicId, organizationId } = query.payload;

    // Tenant sınırı: yalnız kendi organizasyonunun faturaları.
    this.policyFactory
      .organization(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanManageTargetOrganization(organizationId),
        'Fatura listeleme yetkiniz yok.'
      )
      .orThrow();

    // Klinik daraltması istenmişse aktörün o kliniğe erişimi olmalı (sistem çağrıları bypass).
    if (clinicId) {
      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check((p) => p.actorCanAccessTargetClinic(clinicId))
        .orThrow();
    }

    const result = await this.invoiceRepo.findMany(
      { organizationId, clinicId },
      pagination
    );

    return {
      data: result.items.map((invoice) => this.toListItem(invoice)),
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: clinicId
          ? this.policyFactory
              .finance(ctx.actor, ctx.source)
              .policy.getSerializationOptions({ clinicId })
          : this.policyFactory
              .finance(ctx.actor, ctx.source)
              .policy.getOrganizationSerializationOptions({ organizationId }),
      },
    };
  }

  private toListItem(invoice: IInvoice): InvoiceListItem {
    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      clinicId: invoice.clinicId,
      patientId: invoice.patientId,
      grandTotal: taxSpecificationOf(invoice).grossAmount.value.toFixed(2),
      currency: invoice.currency,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      createdAt: invoice.createdAt,
    };
  }
}
