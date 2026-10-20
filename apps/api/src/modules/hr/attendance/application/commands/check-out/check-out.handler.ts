import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CheckOutCommand } from './check-out.command';
import { AttendanceNotCheckedInException } from '@modules/hr/attendance/domain/exceptions/attendance.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ATTENDANCE_EVENTS } from '@src/domain/constants/events/attendance.constant';
import {
  ATTENDANCE_COMMAND_REPOSITORY,
  IAttendanceCommandRepository,
} from '@modules/hr/attendance/domain/repositories/attendance/attendance.command.repository';

@CommandHandler(CheckOutCommand)
export class CheckOutHandler implements ICommandHandler<CheckOutCommand, void> {
  constructor(
    @Inject(ATTENDANCE_COMMAND_REPOSITORY)
    private readonly attendanceRepo: IAttendanceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CheckOutCommand): Promise<void> {
    const { employeeId, ctx } = command;

    this.policyFactory
      .employee(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicHr(ctx.actor.clinicId))
      .orThrow(ATTENDANCE_EVENTS.CHECK_OUT);

    await this.txManager.run(async () => {
      const workDate = DateTimeManager.startOfDay(DateTimeManager.create());
      const existing = await this.attendanceRepo.findByEmployeeAndDate(
        employeeId,
        workDate
      );
      if (!existing) {
        throw new AttendanceNotCheckedInException(employeeId);
      }

      existing.checkOut();
      await this.attendanceRepo.update(existing);
    });
  }
}
