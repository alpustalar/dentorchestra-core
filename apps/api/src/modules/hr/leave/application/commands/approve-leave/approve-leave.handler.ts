import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ApproveLeaveCommand } from './approve-leave.command';
import {
  LeaveInsufficientBalanceException,
  LeaveNotFoundException,
} from '@modules/hr/leave/domain/exceptions/leave.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { LeaveBalance } from '@modules/hr/leave/domain/value-objects/leave-balance.vo';
import { LEAVE_EVENTS } from '@src/domain/constants/events';
import {
  ILeaveCommandRepository,
  LEAVE_COMMAND_REPOSITORY,
} from '@modules/hr/leave/domain/repositories/leave/leave.command.repository';
import {
  EMPLOYEE_LEAVE_ENTITLEMENT_SERVICE,
  IEmployeeLeaveEntitlementService,
} from '@modules/hr/employee/domain/services/leave-entitlement/leave-entitlement.service.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@CommandHandler(ApproveLeaveCommand)
export class ApproveLeaveHandler
  implements ICommandHandler<ApproveLeaveCommand, void>
{
  constructor(
    @Inject(LEAVE_COMMAND_REPOSITORY)
    private readonly leaveRepo: ILeaveCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(EMPLOYEE_LEAVE_ENTITLEMENT_SERVICE)
    private readonly entitlementService: IEmployeeLeaveEntitlementService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ApproveLeaveCommand): Promise<void> {
    const { leaveId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      // Kilitli okuma: aynı talebin iki kez onaylanıp günlerin iki kez
      // düşülmesini engeller.
      const leave = await this.leaveRepo.findByIdForUpdate(leaveId);
      if (!leave) throw new LeaveNotFoundException(leaveId);

      this.policyFactory
        .employee(ctx.actor, ctx.source)
        .evaluator.check((p) => p.canManageClinicHr(leave.clinicId.value))
        .orThrow(LEAVE_EVENTS.APPROVED);

      // Yıllık izinde kalan bakiye kontrolü — negatife düşürülemez.
      if (leave.validate.type.isAnnual().value) {
        await this.assertAnnualBalance(leave.employeeId.value, leave.days);
      }

      const validateOptions = this.policyFactory
        .entity(ctx.actor, ctx.source)
        .policy.getValidateOptions();

      leave.rules(validateOptions).approve();

      leave.approve(ctx.actor.userId, data.note);

      await this.leaveRepo.update(leave);
    });
  }

  private async assertAnnualBalance(
    employeeId: string,
    requestedDays: number
  ): Promise<void> {
    // Hak ediş, çalışan satırı kilitlenerek ve **aynı çağrıda** okunur: kilit alma
    // ile kilitli veriyi okuma ayrı adımlara bölünseydi sırayı bozmak derleyicinin
    // göremediği bir hata olurdu. Bu kilit aynı zamanda bakiyenin çapasıdır — aynı
    // çalışanın iki izni eşzamanlı onaylanırken ikisi de aynı "kalan"ı göremez.
    const entitlement =
      await this.entitlementService.lockAndGetAnnualEntitlement(employeeId);

    // Devreden hak için hak edişin doğduğu ilk yıldan bugüne kadarki tüm onaylı
    // izinler taranır; tek bir yılın penceresi kazanılmış hakkı görmezdi.
    const now = DateTimeManager.create();
    const from = DateTimeManager.startOfYear(entitlement.firstAccrualYear);
    const { to } = LeaveBalance.periodOf(now);

    const leaves = await this.leaveRepo.findApprovedAnnualLeaves(
      employeeId,
      from,
      to
    );

    const balance = LeaveBalance.accrue({ entitlement, leaves, asOf: now });

    if (balance.exceeds(requestedDays)) {
      throw new LeaveInsufficientBalanceException(
        requestedDays,
        balance.remaining
      );
    }
  }
}
