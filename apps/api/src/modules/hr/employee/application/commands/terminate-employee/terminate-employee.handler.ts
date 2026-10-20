import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TerminateEmployeeCommand } from './terminate-employee.command';
import { EmployeeNotFoundException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { EMPLOYEE_EVENTS } from '@src/domain/constants/events/employee.constant';
import {
  EMPLOYEE_EVENT_PUBLISHER,
  IEmployeeEventPublisher,
} from '@modules/hr/employee/domain/interfaces/employee-event-publisher.interface';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import {
  EMPLOYEE_COMMAND_REPOSITORY,
  IEmployeeCommandRepository,
} from '@modules/hr/employee/domain/repositories/employee/employee.command.repository';
import {
  EMPLOYEE_CONTRACT_COMMAND_REPOSITORY,
  IEmployeeContractCommandRepository,
} from '@modules/hr/employee/domain/repositories/employee-contract/employee-contract.command.repository';

@CommandHandler(TerminateEmployeeCommand)
export class TerminateEmployeeHandler
  implements ICommandHandler<TerminateEmployeeCommand, void>
{
  constructor(
    @Inject(EMPLOYEE_COMMAND_REPOSITORY)
    private readonly employeeRepo: IEmployeeCommandRepository,
    @Inject(EMPLOYEE_CONTRACT_COMMAND_REPOSITORY)
    private readonly employeeContractRepo: IEmployeeContractCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(EMPLOYEE_EVENT_PUBLISHER)
    private readonly eventPublisher: IEmployeeEventPublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: TerminateEmployeeCommand): Promise<void> {
    const { employeeId, ctx, data } = command.payload;
    const terminationDate = data.terminationDate ?? DateTimeManager.create();

    await this.txManager.run(async () => {
      const employee = await this.employeeRepo.findById(employeeId);
      if (!employee) throw new EmployeeNotFoundException(employeeId);

      this.policyFactory
        .employee(ctx.actor, ctx.source)
        .evaluator.check((p) => p.canManageClinicHr(employee.clinicId.value))
        .orThrow(EMPLOYEE_EVENTS.TERMINATE);

      employee.terminate(terminationDate);
      await this.employeeRepo.update(employee);

      // Aktif sözleşmeyi de sonlandır.
      const active =
        await this.employeeContractRepo.findActiveByEmployeeId(employeeId);
      if (active) {
        active.end(terminationDate);
        await this.employeeContractRepo.update(active);
      }

      this.eventPublisher.employeeTerminated({
        employeeId,
        clinicId: employee.clinicId.value,
        terminationDate,
        actorId: ctx.actor.userId,
        source: LogSource.WEB,
        action: LogAction.EMPLOYEE_TERMINATE,
        type: LogType.INFO,
        details: `Personel işten çıkarıldı: ${employee.fullName.value}`,
      });
    });
  }
}
