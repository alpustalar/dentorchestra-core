import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetWorkOrderByIdQuery } from './get-work-order-by-id.query';
import { GetWorkOrderByIdResponse } from './get-work-order-by-id.response';
import { WorkOrderNotFoundException } from '@modules/supply/work-order/domain/exceptions/work-order.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  EXTERNAL_WORK_ORDER_QUERY_REPOSITORY,
  IExternalWorkOrderQueryRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work.query.repository';

@QueryHandler(GetWorkOrderByIdQuery)
export class GetWorkOrderByIdHandler implements IQueryHandler<
  GetWorkOrderByIdQuery,
  GetWorkOrderByIdResponse
> {
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_QUERY_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetWorkOrderByIdQuery
  ): Promise<GetWorkOrderByIdResponse> {
    const { workOrderId, ctx } = query;

    const workOrder = await this.workOrderRepo.findById(workOrderId);
    if (!workOrder) throw new WorkOrderNotFoundException(workOrderId);

    const { evaluator, policy } = this.policyFactory.workOrder(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicWorkOrders(workOrder.clinicId))
      .orThrow('work-order.detail');

    return {
      data: workOrder,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: workOrder.clinicId,
        }),
      },
    };
  }
}
