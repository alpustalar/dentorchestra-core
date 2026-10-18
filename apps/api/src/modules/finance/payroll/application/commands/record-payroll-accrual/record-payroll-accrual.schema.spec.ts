import { RecordPayrollAccrualSchema } from '@shared/modules/payroll/schemas/commands';

/**
 * Bordro kapısının kabul kümesi.
 *
 * `employeeUserId` **UUID DEĞİL**: `User.id` bir Firebase UID'dir. `z.uuid()`
 * ile doğrulanırken uç gerçek bir personelle hiç çalışmıyordu (her istek 400).
 * Tutarlar kuruş hassasiyetinde olmak zorunda: döküm `toFixed(2)` ile
 * yazıldığı için üçüncü basamak yuvarlanıp denge özdeşliğini bozabiliyordu.
 */
describe('RecordPayrollAccrualSchema', () => {
  const base = {
    employeeUserId: 'kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG',
    clinicId: '22222222-2222-4222-8222-222222222222',
    accrualDate: '2026-10-01T00:00:00.000Z',
    grossSalary: 30000,
    employerSgk: 6150,
    netPayable: 24000,
    taxWithholding: 2000,
    employeeSgk: 4000,
  };

  it('Firebase UID taşıyan personel kimliğini kabul eder', () => {
    const result = RecordPayrollAccrualSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('kuruştan ince tutarı reddeder', () => {
    const result = RecordPayrollAccrualSchema.safeParse({
      ...base,
      grossSalary: 30000.005,
    });
    expect(result.success).toBe(false);
  });

  it('kiracı kimliğini istemciden almaz (organizationId şemada yok)', () => {
    const result = RecordPayrollAccrualSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('organizationId');
  });
});
