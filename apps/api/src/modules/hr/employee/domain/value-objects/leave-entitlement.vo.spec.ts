import { LeaveEntitlement } from './leave-entitlement.vo';
import { EmployeeInvalidEntitlementException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const day = (iso: string): Date =>
  DateTimeManager.fromLocalDateTime(iso, '09:00');

describe('LeaveEntitlement VO', () => {
  const entitlement = LeaveEntitlement.of({
    hireDate: day('2024-03-01'),
    annualDays: 14,
  });

  it('hak ediş işe giriş yılının ertesi yılında doğar (4857/53)', () => {
    expect(entitlement.firstAccrualYear).toBe(2025);
    expect(entitlement.daysForYear(2024)).toBe(0);
    expect(entitlement.daysForYear(2025)).toBe(14);
  });

  it('kıdem yıl dönümü ay ortasına düşse de takvim yılı tam sayılır', () => {
    // İzin yılı takvim yılı olarak modellendiği için (bkz. LeaveBalance.periodOf)
    // 1 Mart 2025'te doğan hak, 2025'in tamamı için tam gün olarak işlenir.
    const lateHire = LeaveEntitlement.of({
      hireDate: day('2024-12-31'),
      annualDays: 14,
    });

    expect(lateHire.daysForYear(2025)).toBe(14);
  });

  it('accrualYears ilk hak ediş yılından asOf yılına kadar uzanır', () => {
    expect(entitlement.accrualYears(day('2027-06-15'))).toEqual([
      2025, 2026, 2027,
    ]);
  });

  it('henüz hak ediş doğmadıysa accrualYears boştur', () => {
    const fresh = LeaveEntitlement.of({
      hireDate: day('2027-02-01'),
      annualDays: 14,
    });

    expect(fresh.accrualYears(day('2027-06-15'))).toEqual([]);
  });

  it('negatif veya tam sayı olmayan hak ediş reddedilir', () => {
    expect(() =>
      LeaveEntitlement.of({ hireDate: day('2024-03-01'), annualDays: -1 })
    ).toThrow(EmployeeInvalidEntitlementException);

    expect(() =>
      LeaveEntitlement.of({ hireDate: day('2024-03-01'), annualDays: 12.5 })
    ).toThrow(EmployeeInvalidEntitlementException);
  });

  it('sıfır gün hak ediş geçerlidir (ör. stajyer)', () => {
    expect(
      LeaveEntitlement.of({ hireDate: day('2024-03-01'), annualDays: 0 })
        .annualDays
    ).toBe(0);
  });
});
