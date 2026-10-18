import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetWorkOrdersQuery } from './get-work-orders.query';
import { GetWorkOrdersResponse } from './get-work-orders.response';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  EXTERNAL_WORK_ORDER_QUERY_REPOSITORY,
  IExternalWorkOrderQueryRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work.query.repository';

@QueryHandler(GetWorkOrdersQuery)
export class GetWorkOrdersHandler implements IQueryHandler<
  GetWorkOrdersQuery,
  GetWorkOrdersResponse
> {
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_QUERY_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetWorkOrdersQuery): Promise<GetWorkOrdersResponse> {
    const { filter, pagination, ctx } = query.payload;
    const clinicId = ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.workOrder(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicWorkOrders(clinicId))
      .orThrow('work-order.list');

    const result = await this.workOrderRepo.findByClinic({
      clinicId,
      status: filter.status,
      supplierId: filter.supplierId,
      patientId: filter.patientId,
      overdue: filter.overdue,
      dueBefore: filter.dueBefore,
      pagination,
    });

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: clinicId,
        }),
      },
    };
  }
}
