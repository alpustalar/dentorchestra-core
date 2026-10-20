import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetWorkOrderSummaryQuery } from './get-work-order-summary.query';
import { GetWorkOrderSummaryResponse } from './get-work-order-summary.response';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  EXTERNAL_WORK_ORDER_QUERY_REPOSITORY,
  IExternalWorkOrderQueryRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work.query.repository';

/** Klinik panosu: statü başına iş emri adedi + termini geçen adedi. */
@QueryHandler(GetWorkOrderSummaryQuery)
export class GetWorkOrderSummaryHandler
  implements
    IQueryHandler<GetWorkOrderSummaryQuery, GetWorkOrderSummaryResponse>
{
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_QUERY_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetWorkOrderSummaryQuery
  ): Promise<GetWorkOrderSummaryResponse> {
    const { ctx } = query;
    const clinicId = ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.workOrder(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicWorkOrders(clinicId))
      .orThrow('work-order.summary');

    const summary = await this.workOrderRepo.summarizeByClinic(
      clinicId,
      DateTimeManager.create()
    );

    return {
      data: summary,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
