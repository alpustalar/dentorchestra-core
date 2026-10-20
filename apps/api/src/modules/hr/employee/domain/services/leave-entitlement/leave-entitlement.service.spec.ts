import { EmployeeLeaveEntitlementService } from './leave-entitlement.service';
import { IEmployeeCommandRepository } from '@modules/hr/employee/domain/repositories/employee/employee.command.repository';
import { Employee } from '@modules/hr/employee/domain/entities/employee.entity';
import { EmployeeNotFoundException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

describe('EmployeeLeaveEntitlementService', () => {
  const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
  const hireDate = DateTimeManager.fromLocalDateTime('2024-03-01', '09:00');

  const build = (employee: Partial<Employee> | null) => {
    const findByIdForUpdate = jest.fn().mockResolvedValue(employee);
    // Kilitsiz `findById` bilerek tanımsız: servis ona uzanırsa test patlar.
    const employeeRepo = {
      findByIdForUpdate,
    } as unknown as IEmployeeCommandRepository;

    return {
      service: new EmployeeLeaveEntitlementService(employeeRepo),
      findByIdForUpdate,
      employeeRepo,
    };
  };

  it('hak edişi kilitli okumadan türetir', async () => {
    const { service, findByIdForUpdate, employeeRepo } = build({
      hireDate,
      annualLeaveEntitlement: 20,
    } as Employee);

    const entitlement = await service.lockAndGetAnnualEntitlement(EMPLOYEE_ID);

    expect(entitlement.annualDays).toBe(20);
    expect(entitlement.firstAccrualYear).toBe(2025);

    // Kilit ve okuma tek çağrıda: ayrı adımlara bölünseydi sırayı bozmak
    // derleyicinin göremediği bir hata olurdu.
    expect(findByIdForUpdate).toHaveBeenCalledWith(EMPLOYEE_ID);
    expect((employeeRepo as { findById?: unknown }).findById).toBeUndefined();
  });

  it('çalışan yoksa EmployeeNotFoundException', async () => {
    const { service } = build(null);

    await expect(
      service.lockAndGetAnnualEntitlement(EMPLOYEE_ID)
    ).rejects.toBeInstanceOf(EmployeeNotFoundException);
  });
});
