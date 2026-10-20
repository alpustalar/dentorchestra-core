import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLeaveBalanceQuery } from './get-leave-balance.query';
import { GetLeaveBalanceResponse } from './get-leave-balance.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetEmployeeByIdQuery } from '@modules/hr/employee/application/queries/get-employee-by-id/get-employee-by-id.query';
import { LeaveBalance } from '@modules/hr/leave/domain/value-objects/leave-balance.vo';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ILeaveQueryRepository,
  LEAVE_QUERY_REPOSITORY,
} from '@modules/hr/leave/domain/repositories/leave/leave.query.repository';
import { LeaveEntitlement } from '@modules/hr/employee/domain/value-objects/leave-entitlement.vo';
import { EmployeeNotFoundException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@QueryHandler(GetLeaveBalanceQuery)
export class GetLeaveBalanceHandler
  implements IQueryHandler<GetLeaveBalanceQuery, GetLeaveBalanceResponse>
{
  constructor(
    @Inject(LEAVE_QUERY_REPOSITORY)
    private readonly leaveRepo: ILeaveQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(query: GetLeaveBalanceQuery): Promise<GetLeaveBalanceResponse> {
    const { employeeId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.employee(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canManageClinicHr(ctx.actor.clinicId))
      .orThrow('leave.balance');

    // Hak ediş çalışan modülünden (cross-module, QueryBus). Okuma tarafı kilit
    // ALMAZ — kilitli varyant (`lockAndGetAnnualEntitlement`) yalnız yazma
    // kararını besleyen onay akışına aittir.
    const { data: employee } = await this.queryBus.execute(
      new GetEmployeeByIdQuery(employeeId, ctx)
    );
    if (!employee) throw new EmployeeNotFoundException(employeeId);

    const entitlement = LeaveEntitlement.of({
      hireDate: employee.hireDate,
      annualDays: employee.annualLeaveEntitlement,
    });

    // Devreden hak için hak edişin doğduğu ilk yıldan bugüne kadarki tüm onaylı
    // izinler taranır; bakiye aritmetiği domain'de (LeaveBalance) — onay akışıyla
    // birebir aynı hesap, iki yerde ayrı ayrı yazılmaz.
    const now = DateTimeManager.create();
    const { to } = LeaveBalance.periodOf(now);
    const leaves = await this.leaveRepo.findApprovedAnnualLeaves(
      employeeId,
      DateTimeManager.startOfYear(entitlement.firstAccrualYear),
      to
    );

    const balance = LeaveBalance.accrue({ entitlement, leaves, asOf: now });

    return {
      data: balance.toView(),
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: ctx.actor.clinicId ?? '',
        }),
      },
    };
  }
}
