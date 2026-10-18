import { PayrollBreakdown } from './payroll-breakdown.vo';
import { UnbalancedPayrollBreakdownException } from '@modules/finance/shared/domain/exceptions';

/**
 * Bordro dökümünün denge özdeşliği: brüt = net + stopaj + işçi SGK.
 * Dengesiz döküm fişe dönerse yevmiye "Σborç = Σalacak" kontrolünde,
 * sebebinden kopuk bir yerde patlar.
 */
describe('PayrollBreakdown', () => {
  const balanced = {
    grossSalary: '30000.00',
    netPayable: '24000.00',
    taxWithholding: '2000.00',
    employeeSgk: '4000.00',
    employerSgk: '6150.00',
  };

  it('dengeli dökümü kabul eder ve kuruş formatında taşır', () => {
    const breakdown = PayrollBreakdown.create(balanced).orThrow();

    expect(breakdown.grossSalary).toBe('30000.00');
    expect(breakdown.netPayable).toBe('24000.00');
    expect(breakdown.employerSgk).toBe('6150.00');
  });

  it('dengesiz dökümde tipli domain hatası fırlatır (ham Error değil)', () => {
    const unbalanced = { ...balanced, taxWithholding: '2500.00' };

    expect(() => PayrollBreakdown.create(unbalanced).orThrow()).toThrow(
      UnbalancedPayrollBreakdownException
    );

    try {
      PayrollBreakdown.create(unbalanced).orThrow();
    } catch (error) {
      const typed = error as UnbalancedPayrollBreakdownException;
      // Frontend hangi iki tutarın uyuşmadığını görebilmeli.
      expect(typed.meta).toEqual({
        grossSalary: '30000.00',
        decomposed: '30500.00',
      });
      expect(typed.errorCode).toBe('PAYROLL.UNBALANCED_BREAKDOWN');
    }
  });

  it('işveren SGK dengeye girmez (işveren maliyeti, brütün parçası değil)', () => {
    const breakdown = PayrollBreakdown.create({
      ...balanced,
      employerSgk: '0.00',
    }).orThrow();

    expect(breakdown.grossSalary).toBe('30000.00');
  });
});
