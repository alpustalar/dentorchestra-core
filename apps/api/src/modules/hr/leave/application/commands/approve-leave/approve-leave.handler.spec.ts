import { ApproveLeaveHandler } from './approve-leave.handler';
import { ApproveLeaveCommand } from './approve-leave.command';
import { LeaveRequest } from '@modules/hr/leave/domain/entities/leave-request.entity';
import { ILeaveCommandRepository } from '@modules/hr/leave/domain/repositories/leave/leave.command.repository';
import {
  LeaveInsufficientBalanceException,
  LeaveNotFoundException,
} from '@modules/hr/leave/domain/exceptions/leave.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { IEmployeeLeaveEntitlementService } from '@modules/hr/employee/domain/services/leave-entitlement/leave-entitlement.service.interface';
import { LeaveEntitlement } from '@modules/hr/employee/domain/value-objects/leave-entitlement.vo';
import { AnnualLeavePeriod } from '@modules/hr/leave/domain/contracts/leave-request';

describe('ApproveLeaveHandler — bakiye kilidi (çalışan satırı çapası)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';

  const ctx: IGetContext = {
    actor: {
      userId: 'user-1',
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** Bu yıl içinde, `days` gün süren bekleyen yıllık izin talebi. */
  const makeAnnualLeave = (days: number): LeaveRequest => {
    const now = DateTimeManager.create();
    const startDate = DateTimeManager.startOfYear(DateTimeManager.getYear(now));
    return LeaveRequest.create({
      employeeId: EMPLOYEE_ID,
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      type: 'ANNUAL',
      startDate,
      endDate: DateTimeManager.addDays(startDate, days - 1),
    });
  };

  /** `days` gün süren, geçmişte kullanılmış onaylı izin (bu yıl içinde). */
  const usedLeave = (days: number): AnnualLeavePeriod => {
    const now = DateTimeManager.create();
    const startDate = DateTimeManager.startOfYear(DateTimeManager.getYear(now));
    return {
      startDate,
      endDate: DateTimeManager.addDays(startDate, days - 1),
    };
  };

  interface BuildOptions {
    leave: LeaveRequest | null;
    entitlement?: number;
    usedDays?: number;
  }

  const build = ({ leave, entitlement = 14, usedDays = 0 }: BuildOptions) => {
    const callOrder: string[] = [];

    const findByIdForUpdate = jest.fn(() => {
      callOrder.push('load');
      return Promise.resolve(leave);
    });
    const findApprovedAnnualLeaves = jest.fn(() => {
      callOrder.push('readUsed');
      return Promise.resolve(usedDays > 0 ? [usedLeave(usedDays)] : []);
    });
    const update = jest.fn((e: LeaveRequest) => {
      callOrder.push('update');
      return Promise.resolve(e);
    });

    const leaveRepo = {
      findByIdForUpdate,
      findApprovedAnnualLeaves,
      update,
    } as unknown as ILeaveCommandRepository;

    // Hak ediş çalışanın satırını kilitleyerek okunur; bu yıl hak edişin doğmuş
    // olması için işe giriş geçen yıl.
    const lockAndGetAnnualEntitlement = jest.fn(() => {
      callOrder.push('lockAndGetEntitlement');
      return Promise.resolve(
        LeaveEntitlement.of({
          hireDate: DateTimeManager.startOfYear(
            DateTimeManager.currentYear() - 1
          ),
          annualDays: entitlement,
        })
      );
    });

    const entitlementService = {
      lockAndGetAnnualEntitlement,
    } as unknown as IEmployeeLeaveEntitlementService;

    const policyFactory = {
      employee: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
      entity: jest.fn().mockReturnValue({
        policy: { getValidateOptions: () => undefined },
      }),
    } as never;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    return {
      handler: new ApproveLeaveHandler(
        leaveRepo,
        policyFactory,
        entitlementService,
        txManager
      ),
      leaveRepo,
      findByIdForUpdate,
      lockAndGetAnnualEntitlement,
      update,
      callOrder,
    };
  };

  const command = (leaveId: string) =>
    new ApproveLeaveCommand({ leaveId, data: {}, ctx });

  it('bakiye yeterliyse izni onaylar', async () => {
    const leave = makeAnnualLeave(5);
    const { handler, update } = build({ leave, entitlement: 14 });

    await handler.execute(command(leave.id.value));

    expect(leave.status).toBe('APPROVED');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('hak ediş kilitli okunur ve kullanım okumasından ÖNCE gelir', async () => {
    const leave = makeAnnualLeave(5);
    const { handler, lockAndGetAnnualEntitlement, callOrder } = build({
      leave,
    });

    await handler.execute(command(leave.id.value));

    expect(lockAndGetAnnualEntitlement).toHaveBeenCalledWith(EMPLOYEE_ID);
    // Kilit önce alınmazsa iki eşzamanlı onay aynı "kalan"ı okur → negatif bakiye.
    expect(callOrder.indexOf('lockAndGetEntitlement')).toBeLessThan(
      callOrder.indexOf('readUsed')
    );
  });

  it('kilitsiz okuma yolları hiç kullanılmaz', async () => {
    const leave = makeAnnualLeave(5);
    const { handler, leaveRepo } = build({ leave });

    await handler.execute(command(leave.id.value));

    // Mock'ta bilerek tanımsız: handler bunlara uzanırsa test patlar.
    expect((leaveRepo as { findById?: unknown }).findById).toBeUndefined();
  });

  it('kalan bakiyeyi aşan talep reddedilir ve yazma yapılmaz', async () => {
    const leave = makeAnnualLeave(10);
    // Bu yıl 12 gün kullanılmış; geçen yıldan devreden yok (işe giriş geçen yıl,
    // hak ediş bu yıl doğdu) → kalan 2 gün.
    const { handler, update } = build({
      leave,
      entitlement: 14,
      usedDays: 12,
    });

    await expect(handler.execute(command(leave.id.value))).rejects.toThrow(
      LeaveInsufficientBalanceException
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('talep yoksa LeaveNotFoundException', async () => {
    const { handler } = build({ leave: null });

    await expect(
      handler.execute(command('44444444-4444-4444-8444-444444444444'))
    ).rejects.toBeInstanceOf(LeaveNotFoundException);
  });

  it('yıllık olmayan izinde bakiye hiç sorgulanmaz', async () => {
    const now = DateTimeManager.create();
    const startDate = DateTimeManager.startOfYear(DateTimeManager.getYear(now));
    const sickLeave = LeaveRequest.create({
      employeeId: EMPLOYEE_ID,
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      type: 'SICK',
      startDate,
      endDate: DateTimeManager.addDays(startDate, 2),
    });

    const { handler, lockAndGetAnnualEntitlement, update } = build({
      leave: sickLeave,
    });

    await handler.execute(command(sickLeave.id.value));

    // Rapor yıllık hak edişten düşmez; gereksiz kilit de alınmamalı.
    expect(lockAndGetAnnualEntitlement).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
