import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetPaymentWithInstallmentsQuery } from './get-payment-with-installments.query';
import { GetPaymentWithInstallmentsResponse } from './get-payment-with-installments.response';
import { paymentHasInstallments } from '@shared/modules/payment/interfaces/payment-with-installments.interface';
import { QueryResponseNull } from '@common/constants';
import {
  IPaymentQueryRepository,
  PAYMENT_QUERY_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';

@QueryHandler(GetPaymentWithInstallmentsQuery)
export class GetPaymentWithInstallmentsHandler implements IQueryHandler<
  GetPaymentWithInstallmentsQuery,
  GetPaymentWithInstallmentsResponse
> {
  constructor(
    @Inject(PAYMENT_QUERY_REPOSITORY)
    private readonly paymentRepo: IPaymentQueryRepository
  ) {}

  async execute(
    query: GetPaymentWithInstallmentsQuery
  ): Promise<GetPaymentWithInstallmentsResponse> {
    const payment = await this.paymentRepo.findPaymentWithInstallments(
      query.paymentId
    );

    if (!payment) {
      return QueryResponseNull;
    }

    // Repo zaten taksitleriyle birlikte düz kayıt döner; tip daraltması taksit
    // dizisinin dolu olduğunu garanti eder.
    return {
      data: paymentHasInstallments(payment) ? payment : null,
    };
  }
}
