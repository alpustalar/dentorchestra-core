import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindCollectedPaymentsQuery } from './find-collected-payments.query';
import { FindCollectedPaymentsResponse } from './find-collected-payments.response';
import {
  IPaymentQueryRepository,
  PAYMENT_QUERY_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(FindCollectedPaymentsQuery)
export class FindCollectedPaymentsHandler implements IQueryHandler<
  FindCollectedPaymentsQuery,
  FindCollectedPaymentsResponse
> {
  constructor(
    @Inject(PAYMENT_QUERY_REPOSITORY)
    private readonly paymentQueryRepo: IPaymentQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindCollectedPaymentsQuery
  ): Promise<FindCollectedPaymentsResponse> {
    const { filter, ctx } = query.payload;

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.actorCanAccessTargetClinic(filter.clinicId),
        'Bu şubenin tahsilatlarını görme yetkiniz yok.'
      )
      .orThrow();

    return {
      data: await this.paymentQueryRepo.findCollectedPayments(filter),
    };
  }
}
