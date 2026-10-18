import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInvoiceByAppointmentIdQuery } from './get-invoice-by-appointment-id.query';
import { GetInvoiceByAppointmentIdResponse } from './get-invoice-by-appointment-id.response';
import {
  INVOICE_QUERY_REPOSITORY,
  IInvoiceQueryRepository,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.query.repository';

@QueryHandler(GetInvoiceByAppointmentIdQuery)
export class GetInvoiceByAppointmentIdHandler implements IQueryHandler<
  GetInvoiceByAppointmentIdQuery,
  GetInvoiceByAppointmentIdResponse
> {
  constructor(
    @Inject(INVOICE_QUERY_REPOSITORY)
    private readonly invoiceRepo: IInvoiceQueryRepository
  ) {}

  async execute(
    query: GetInvoiceByAppointmentIdQuery
  ): Promise<GetInvoiceByAppointmentIdResponse> {
    return {
      data: await this.invoiceRepo.findByAppointmentId(query.appointmentId),
    };
  }
}
