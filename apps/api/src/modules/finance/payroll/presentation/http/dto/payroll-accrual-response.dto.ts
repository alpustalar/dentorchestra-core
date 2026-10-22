import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Bordro tahakkuku okuma modeli (FinancialEvent(PAYROLL_ACCRUED) + Party adı).
 * Maaş rakamları herkese açık değildir — FINANCIAL ve üzeri gruba kapalı.
 */
export class PayrollAccrualResponseDto {
  @Expose(FIN) financialEventId: string;
  @Expose(FIN) clinicId: string;
  @Expose(FIN) partyId: string;
  @Expose(FIN) employeeUserId: string | null;
  @Expose(FIN) employeeName: string | null;
  @Expose(FIN) monthKey: string;

  @Expose(FIN)
  @Type(() => Date)
  accrualDate: Date;

  @Expose(FIN) grossSalary: string;
  @Expose(FIN) employerSgk: string;
  @Expose(FIN) netPayable: string;
  @Expose(FIN) taxWithholding: string;
  @Expose(FIN) employeeSgk: string;

  // Mutabakat/idempotentlik izi — destek ekranına sızmasın.
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  dedupeKey: string | null;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;
}
